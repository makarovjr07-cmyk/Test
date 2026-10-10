$routes = @(
  '/',
  '/about',
  '/who-we-are',
  '/our-history',
  '/mission-vision',
  '/principal-message',
  '/management-committee',
  '/administrative-staff',
  '/faculty-members',
  '/facilities',
  '/cafeteria',
  '/library',
  '/labs',
  '/first-aid',
  '/sports-eca',
  '/admissions',
  '/gallery',
  '/notice-board',
  '/contact',
  '/teachers',
  '/result',
  '/admin/login'
)

$issues = @()

foreach ($route in $routes) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing ("http://localhost:3001" + $route)
    $body = $resp.Content

    if ($resp.StatusCode -ne 200) {
      $issues += "$route status $($resp.StatusCode)"
    }

    if ($body -match 'Twitter|Instagram|\\n\\n') {
      $issues += "$route has unwanted text"
    }
  } catch {
    $issues += "$route error $($_.Exception.Message)"
  }
}

if ($issues.Count -eq 0) {
  'OK'
} else {
  $issues
}
