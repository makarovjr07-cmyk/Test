param(
  [string]$Root = "frontend/photos",
  [int]$MaxLongEdge = 1600,
  [int]$JpegQuality = 82
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

$preservedPngNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@("logo.png", "logo-round.png") | ForEach-Object { [void]$preservedPngNames.Add($_) }

$summary = [ordered]@{
  processed = 0
  updated = 0
  converted = 0
  skipped = 0
  bytesBefore = 0L
  bytesAfter = 0L
}

function Get-RotateFlipType {
  param([System.Drawing.Image]$Image)

  $orientationId = 0x0112
  if (-not ($Image.PropertyIdList -contains $orientationId)) {
    return [System.Drawing.RotateFlipType]::RotateNoneFlipNone
  }

  try {
    $orientation = [BitConverter]::ToUInt16($Image.GetPropertyItem($orientationId).Value, 0)
  } catch {
    return [System.Drawing.RotateFlipType]::RotateNoneFlipNone
  }

  switch ($orientation) {
    2 { return [System.Drawing.RotateFlipType]::RotateNoneFlipX }
    3 { return [System.Drawing.RotateFlipType]::Rotate180FlipNone }
    4 { return [System.Drawing.RotateFlipType]::Rotate180FlipX }
    5 { return [System.Drawing.RotateFlipType]::Rotate90FlipX }
    6 { return [System.Drawing.RotateFlipType]::Rotate90FlipNone }
    7 { return [System.Drawing.RotateFlipType]::Rotate270FlipX }
    8 { return [System.Drawing.RotateFlipType]::Rotate270FlipNone }
    default { return [System.Drawing.RotateFlipType]::RotateNoneFlipNone }
  }
}

function Normalize-Orientation {
  param([System.Drawing.Image]$Image)

  $rotateFlip = Get-RotateFlipType -Image $Image
  if ($rotateFlip -ne [System.Drawing.RotateFlipType]::RotateNoneFlipNone) {
    $Image.RotateFlip($rotateFlip)
    $orientationId = 0x0112
    try {
      $Image.RemovePropertyItem($orientationId)
    } catch {
    }
  }
}

function Test-HasAlphaChannel {
  param([System.Drawing.Image]$Image)

  return $Image.PixelFormat.ToString() -match "Alpha"
}

function New-ProcessedBitmap {
  param(
    [System.Drawing.Image]$SourceImage,
    [int]$LongEdge,
    [bool]$OpaqueBackground
  )

  $sourceWidth = [int]$SourceImage.Width
  $sourceHeight = [int]$SourceImage.Height
  $largestEdge = [Math]::Max($sourceWidth, $sourceHeight)
  $scale = if ($largestEdge -gt $LongEdge) { $LongEdge / [double]$largestEdge } else { 1.0 }
  $targetWidth = [Math]::Max(1, [int][Math]::Round($sourceWidth * $scale))
  $targetHeight = [Math]::Max(1, [int][Math]::Round($sourceHeight * $scale))

  $pixelFormat = if ($OpaqueBackground) {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  } else {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  }

  $bitmap = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight, $pixelFormat)
  $horizontalResolution = if ($SourceImage.HorizontalResolution -gt 0) { $SourceImage.HorizontalResolution } else { 96 }
  $verticalResolution = if ($SourceImage.VerticalResolution -gt 0) { $SourceImage.VerticalResolution } else { 96 }
  $bitmap.SetResolution($horizontalResolution, $verticalResolution)

  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    if ($OpaqueBackground) {
      $graphics.Clear([System.Drawing.Color]::White)
    } else {
      $graphics.Clear([System.Drawing.Color]::Transparent)
    }
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
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

function Get-RelativePath {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )

  $baseUri = [System.Uri](([System.IO.Path]::GetFullPath($BasePath).TrimEnd('\')) + '\')
  $targetUri = [System.Uri]([System.IO.Path]::GetFullPath($TargetPath))
  return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString().Replace('/', '\'))
}

function Optimize-File {
  param([System.IO.FileInfo]$File)

  $extension = $File.Extension.ToLowerInvariant()
  $isJpeg = $extension -in @(".jpg", ".jpeg")
  $isPng = $extension -eq ".png"

  if (-not $isJpeg -and -not $isPng) {
    return
  }

  if ($isPng -and $preservedPngNames.Contains($File.Name)) {
    $summary.skipped++
    return
  }

  $summary.processed++
  $summary.bytesBefore += $File.Length

  $fileBytes = [System.IO.File]::ReadAllBytes($File.FullName)
  $memoryStream = [System.IO.MemoryStream]::new($fileBytes)
  $image = [System.Drawing.Image]::FromStream($memoryStream)
  try {
    Normalize-Orientation -Image $image

    $shouldConvertPngToJpeg = $isPng -and -not (Test-HasAlphaChannel -Image $image)
    if ($isPng -and -not $shouldConvertPngToJpeg) {
      $summary.skipped++
      $summary.bytesAfter += $File.Length
      return
    }

    $processedBitmap = New-ProcessedBitmap -SourceImage $image -LongEdge $MaxLongEdge -OpaqueBackground:$true
    try {
      $targetPath = if ($shouldConvertPngToJpeg) {
        [System.IO.Path]::ChangeExtension($File.FullName, ".jpg")
      } else {
        $File.FullName
      }
      $tempPath = "$targetPath.__tmp__"
      Save-AsJpeg -Image $processedBitmap -DestinationPath $tempPath -Quality $JpegQuality
      $tempLength = (Get-Item -LiteralPath $tempPath).Length
      $isSmaller = $tempLength -lt $File.Length

      if (-not $isSmaller) {
        Remove-Item -LiteralPath $tempPath -Force
        $summary.skipped++
        $summary.bytesAfter += $File.Length
        return
      }

      if ($shouldConvertPngToJpeg) {
        Remove-Item -LiteralPath $File.FullName -Force
        $summary.converted++
      } elseif (Test-Path -LiteralPath $targetPath) {
        Remove-Item -LiteralPath $targetPath -Force
      }

      if (Test-Path -LiteralPath $targetPath) {
        Remove-Item -LiteralPath $targetPath -Force
      }
      Move-Item -LiteralPath $tempPath -Destination $targetPath
      $newLength = (Get-Item -LiteralPath $targetPath).Length
      $summary.updated++
      $summary.bytesAfter += $newLength
      $relativeTarget = Get-RelativePath -BasePath $rootPath -TargetPath $targetPath
      Write-Output ("optimized {0} -> {1} ({2:N1} KB -> {3:N1} KB)" -f $File.Name, $relativeTarget, ($File.Length / 1KB), ($newLength / 1KB))
    } finally {
      $processedBitmap.Dispose()
    }
  } finally {
    $image.Dispose()
    $memoryStream.Dispose()
  }
}

Get-ChildItem -LiteralPath $rootPath -Recurse -File |
  Sort-Object FullName |
  ForEach-Object { Optimize-File -File $_ }

$totalSavedBytes = $summary.bytesBefore - $summary.bytesAfter
$savedMegabytes = [math]::Round($totalSavedBytes / 1MB, 2)
$beforeMegabytes = [math]::Round($summary.bytesBefore / 1MB, 2)
$afterMegabytes = [math]::Round($summary.bytesAfter / 1MB, 2)

Write-Output ""
Write-Output ("Processed: {0}" -f $summary.processed)
Write-Output ("Updated:   {0}" -f $summary.updated)
Write-Output ("Converted: {0}" -f $summary.converted)
Write-Output ("Skipped:   {0}" -f $summary.skipped)
Write-Output ("Size:      {0} MB -> {1} MB (saved {2} MB)" -f $beforeMegabytes, $afterMegabytes, $savedMegabytes)
