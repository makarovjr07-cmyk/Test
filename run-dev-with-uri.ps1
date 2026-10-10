param(
  [string]$MongoUri = "",
  [string]$MongoFallback = "",
  [string]$SessionSecret = ""
)

$ErrorActionPreference = "Stop"

function Read-RequiredValue([string]$label) {
  while ($true) {
    $value = Read-Host $label
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
    Write-Host "Value is required." -ForegroundColor Yellow
  }
}

if ([string]::IsNullOrWhiteSpace($MongoUri)) {
  try {
    $clip = Get-Clipboard -Raw
    if ($clip -and $clip.Trim().ToLower().StartsWith("mongodb")) {
      $MongoUri = $clip.Trim()
      Write-Host "Using Mongo URI from clipboard." -ForegroundColor Cyan
    }
  } catch {
    # Clipboard may not be available; fall back to prompt.
  }
}

if ([string]::IsNullOrWhiteSpace($MongoUri)) {
  $MongoUri = Read-RequiredValue "Paste MONGODB_URI"
}

if ([string]::IsNullOrWhiteSpace($SessionSecret)) {
  $SessionSecret = Read-Host "Paste SESSION_SECRET (optional)"
}

if ([string]::IsNullOrWhiteSpace($MongoFallback)) {
  $MongoFallback = Read-Host "Paste MONGODB_URI_FALLBACK (optional)"
}

$env:MONGODB_URI = $MongoUri.Trim()

if (-not [string]::IsNullOrWhiteSpace($MongoFallback)) {
  $env:MONGODB_URI_FALLBACK = $MongoFallback.Trim()
}

if (-not [string]::IsNullOrWhiteSpace($SessionSecret)) {
  $env:SESSION_SECRET = $SessionSecret.Trim()
}

Write-Host "Starting server with your pasted MongoDB URI..." -ForegroundColor Green

$nodemonPath = Join-Path $PSScriptRoot "node_modules\.bin\nodemon.cmd"
if (Test-Path $nodemonPath) {
  & $nodemonPath "backend/app.js"
} else {
  node "backend/app.js"
}
