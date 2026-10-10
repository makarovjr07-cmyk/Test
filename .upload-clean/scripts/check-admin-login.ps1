param(
  [Parameter(Mandatory = $true)]
  [string]$Username,
  [Parameter(Mandatory = $true)]
  [string]$Password
)

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3001/admin/login -WebSession $session

$csrf = ([regex]::Match($login.Content, 'name="_csrf" value="([^"]+)"')).Groups[1].Value
$next = ([regex]::Match($login.Content, 'name="next" value="([^"]+)"')).Groups[1].Value
$singletab = ([regex]::Match($login.Content, 'name="singletab" value="([^"]+)"')).Groups[1].Value

if (-not $csrf) {
  throw 'CSRF token not found'
}

$body = @{
  _csrf = $csrf
  next = $next
  singletab = $singletab
  username = $Username
  password = $Password
}

$resp = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3001/admin/login -WebSession $session -Method Post -Body $body

$ok = $false
if ($resp.Content -match 'Dashboard Overview') {
  $ok = $true
} elseif ($resp.BaseResponse.ResponseUri.AbsoluteUri -match '/admin/dashboard') {
  $ok = $true
}

if ($ok) {
  'ADMIN_OK'
} else {
  'ADMIN_FAIL'
}
