param(
  [string]$Root = "frontend/photos",
  [int]$MaxLongEdge = 640,
  [int]$JpegQuality = 72
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$rootPath = (Resolve-Path -LiteralPath $Root).Path
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" }

if (-not $jpegCodec) {
  throw "JPEG codec not available."
}

$ignoredDirectoryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@("Teacher", "management", "collage higlight", "_thumbs") | ForEach-Object { [void]$ignoredDirectoryNames.Add($_) }

$summary = [ordered]@{
  albums = 0
  processed = 0
  updated = 0
  skipped = 0
}

function Save-AsJpeg {
  param(
    [System.Drawing.Image]$Image,
    [string]$DestinationPath,
    [int]$Quality
  )

  $encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
  try {
    $encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
      [System.Drawing.Imaging.Encoder]::Quality,
      [long]$Quality
    )
    $Image.Save($DestinationPath, $jpegCodec, $encoderParameters)
  } finally {
    $encoderParameters.Dispose()
  }
}

function New-ThumbnailBitmap {
  param(
    [System.Drawing.Image]$SourceImage,
    [int]$LongEdge
  )

  $sourceWidth = [int]$SourceImage.Width
  $sourceHeight = [int]$SourceImage.Height
  $largestEdge = [Math]::Max($sourceWidth, $sourceHeight)
  $scale = if ($largestEdge -gt $LongEdge) { $LongEdge / [double]$largestEdge } else { 1.0 }
  $targetWidth = [Math]::Max(1, [int][Math]::Round($sourceWidth * $scale))
  $targetHeight = [Math]::Max(1, [int][Math]::Round($sourceHeight * $scale))

  $bitmap = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $bitmap.SetResolution(96, 96)

  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($SourceImage, 0, 0, $targetWidth, $targetHeight)
  } finally {
    $graphics.Dispose()
  }

  return $bitmap
}

function Get-ThumbnailFileName {
  param([string]$PhotoName)

  $baseName = [System.IO.Path]::GetFileNameWithoutExtension([System.IO.Path]::GetFileName($PhotoName))
  if (-not $baseName) {
    $baseName = "gallery-photo"
  }

  return "$baseName.jpg"
}

function Test-IsGalleryImageFile {
  param([string]$FileName)

  return [System.IO.Path]::GetExtension([string]$FileName).ToLowerInvariant() -match '^\.(gif|jpe?g|png|webp)$'
}

Get-ChildItem -LiteralPath $rootPath -Directory |
  Where-Object { -not $ignoredDirectoryNames.Contains($_.Name) -and -not $_.Name.StartsWith('.') } |
  ForEach-Object {
    $albumDir = $_
    $summary.albums++
    $thumbDir = Join-Path $albumDir.FullName "_thumbs"
    New-Item -ItemType Directory -Path $thumbDir -Force | Out-Null

    Get-ChildItem -LiteralPath $albumDir.FullName -File |
      Where-Object { Test-IsGalleryImageFile $_.Name } |
      ForEach-Object {
        $summary.processed++
        $sourceFile = $_
        $thumbPath = Join-Path $thumbDir (Get-ThumbnailFileName -PhotoName $sourceFile.Name)

        $shouldRegenerate = $true
        if (Test-Path -LiteralPath $thumbPath) {
          $existingThumb = Get-Item -LiteralPath $thumbPath
          if ($existingThumb.LastWriteTimeUtc -ge $sourceFile.LastWriteTimeUtc) {
            $shouldRegenerate = $false
          }
        }

        if (-not $shouldRegenerate) {
          $summary.skipped++
          return
        }

        $sourceBytes = [System.IO.File]::ReadAllBytes($sourceFile.FullName)
        $memoryStream = [System.IO.MemoryStream]::new($sourceBytes)
        $image = [System.Drawing.Image]::FromStream($memoryStream)
        try {
          $thumbBitmap = New-ThumbnailBitmap -SourceImage $image -LongEdge $MaxLongEdge
          try {
            $tempPath = "$thumbPath.__tmp__"
            Save-AsJpeg -Image $thumbBitmap -DestinationPath $tempPath -Quality $JpegQuality
            if (Test-Path -LiteralPath $thumbPath) {
              Remove-Item -LiteralPath $thumbPath -Force
            }
            Move-Item -LiteralPath $tempPath -Destination $thumbPath
            (Get-Item -LiteralPath $thumbPath).LastWriteTimeUtc = $sourceFile.LastWriteTimeUtc
            $summary.updated++
            Write-Output ("thumbnail {0}\\{1}" -f $albumDir.Name, [System.IO.Path]::GetFileName($thumbPath))
          } finally {
            $thumbBitmap.Dispose()
          }
        } finally {
          $image.Dispose()
          $memoryStream.Dispose()
        }
      }
  }

Write-Output ""
Write-Output ("Albums:    {0}" -f $summary.albums)
Write-Output ("Processed: {0}" -f $summary.processed)
Write-Output ("Updated:   {0}" -f $summary.updated)
Write-Output ("Skipped:   {0}" -f $summary.skipped)
