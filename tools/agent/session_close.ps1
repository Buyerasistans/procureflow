$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $root
$env:WIKI_BASE_REF = "origin/main"

Write-Host "== Running memory checks =="

python tools/memory/lint_wiki.py
if ($LASTEXITCODE -ne 0) { throw "lint_wiki failed" }

python tools/memory/domain_coverage.py
if ($LASTEXITCODE -ne 0) { throw "domain_coverage failed" }

python tools/memory/check_pr_wiki_gate.py
if ($LASTEXITCODE -ne 0) { throw "check_pr_wiki_gate failed" }

python tools/memory/update_changelog.py --author "team/platform"
if ($LASTEXITCODE -ne 0) { throw "update_changelog failed" }

Write-Host "== Git status =="
git status --short

Write-Host "`n✅ Session close completed."
Write-Host "Next manual step:"
Write-Host "git add . ; git commit -m 'feat: ...'   (push is manual)"
