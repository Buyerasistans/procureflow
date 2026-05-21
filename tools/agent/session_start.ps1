param(
  [string]$Task = "Genel geliştirme",
  [string]$Domain = "general"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $root

$env:WIKI_BASE_REF = "origin/main"

# Branch bilgisi
$branch = git rev-parse --abbrev-ref HEAD
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Bugünün changelog dosyası
$today = Get-Date -Format "yyyy-MM-dd"
$changelog = "wiki/changelog/$today.md"
if (!(Test-Path $changelog)) {
@"
# Changelog - $today

## Session Notes
- Session initialized.
"@ | Out-File -FilePath $changelog -Encoding utf8
}

# Oturum context dosyası
$contextFile = "tools/agent/SESSION_CONTEXT.md"
@"
# SESSION CONTEXT

- Time: $now
- Branch: $branch
- Base Ref: origin/main
- Domain: $Domain
- Task: $Task

## Must Read
- wiki/domains/$Domain.md
- wiki/changelog/$today.md
- tools/agent/RUNBOOK.md

## Rules
1. Local repo is source of truth.
2. Do not rely on GitHub web state.
3. After changes, run memory gate.
4. Propose wiki/changelog updates.
5. Never skip domain mapping check.
"@ | Out-File -FilePath $contextFile -Encoding utf8

Write-Host "✅ Session initialized"
Write-Host "Context file: $contextFile"
Write-Host "Now give this file to your AI model."
