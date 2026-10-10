param(
  [string]$SymbolNumber = 'KKS-TEST-000'
)

$resp = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3001/result -Method Post -Body @{ symbolNumber = $SymbolNumber }

if ($resp.StatusCode -ne 200) {
  'RESULT_SEARCH_ERROR'
  return
}

if ($resp.Content -match 'Result Not Found') {
  'RESULT_NOT_FOUND_OK'
  return
}

if ($resp.Content -match 'marksheet' -or $resp.Content -match 'Official Record' -or $resp.Content -match 'Symbol No') {
  'RESULT_FOUND_OK'
  return
}

'RESULT_SEARCH_UNEXPECTED'
