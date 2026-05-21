$ErrorActionPreference = "Stop"

$deleted = git diff --cached --name-status |
  Select-String -Pattern '^\s*D\s+' |
  ForEach-Object { ($_ -split "\s+",3)[1] }

if ($deleted.Count -gt 0 -and $env:ALLOW_DELETE -ne "1") {
  Write-Host "❌ Commit blocked: Deleted files detected:" -ForegroundColor Red
  $deleted | ForEach-Object { Write-Host " - $_" }
  Write-Host ""
  Write-Host 'Bilinçli silme için: $env:ALLOW_DELETE="1"; git commit -m "..."' -ForegroundColor Yellow
  exit 1
}

Write-Host "✅ pre-commit delete guard passed."
exit 0
