param(
 [string]$Task = "Genel gelitirme",
 [string]$Domain = "payment-billing"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $root

powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\local_snapshot.ps1"

$env:WIKI_BASE_REF = "origin/main"

$branch = git rev-parse --abbrev-ref HEAD
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$today = Get-Date -Format "yyyy-MM-dd"

$changelog = "wiki/changelog/$today.md"
if (!(Test-Path $changelog)) {
@"
# Changelog - $today

## Session Notes
- Session initialized.
"@ | Out-File -FilePath $changelog -Encoding utf8
}

$contextFile = "tools/agent/SESSION_CONTEXT.md"
@"
# AUTO-GENERATED. DO NOT COMMIT.
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

Write-Host "[OK] Session initialized"
Write-Host "Context file: $contextFile"
Write-Host "Now give this file to your AI model."


