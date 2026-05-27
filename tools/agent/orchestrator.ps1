$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

if ($PSScriptRoot) {
 $root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
} else {
 $root = (Get-Location).Path
}
Set-Location $root

$stateFile = "tools/agent/STATE.md"
$ctxFile = "tools/agent/SESSION_CONTEXT.md"
$briefFile = "tools/agent/AI_BRIEFING.md"

function Get-Field {
 param(
 [string]$text,
 [string]$name,
 [string]$default = ""
 )
 $m = [regex]::Match($text, "(?mi)^\s*$name\s*:\s*(.+?)\s*$")
 if ($m.Success) { return $m.Groups[1].Value.Trim() }
 return $default
}

$stateText = ""
if (Test-Path $stateFile) { $stateText = Get-Content $stateFile -Raw -Encoding UTF8 }

$ctxText = ""
if (Test-Path $ctxFile) { $ctxText = Get-Content $ctxFile -Raw -Encoding UTF8 }

$lastTask = Get-Field -text $stateText -name "task" -default "Kaldım yerden devam"
$lastDomain = Get-Field -text $stateText -name "domain" -default ""
$ctxDomain = Get-Field -text $ctxText -name "domain" -default ""

$domain = "payment-billing"
if ($ctxDomain) { $domain = $ctxDomain }
elseif ($lastDomain) { $domain = $lastDomain }

$domainFile = "wiki/domains/$domain.md"
if (!(Test-Path $domainFile)) {
 $domain = "payment-billing"
}

$branch = git rev-parse --abbrev-ref HEAD
$status = git status --short | Out-String
$head5 = git log --oneline -n 5 | Out-String
$today = Get-Date -Format "yyyy-MM-dd"

$mode = "refresh"
if ($status.Trim().Length -gt 0) { $mode = "task" }

powershell -ExecutionPolicy Bypass -File "tools/agent/session_start.ps1" -Task $lastTask -Domain $domain | Out-Null

$promptFile = "tools/agent/prompts/02_session_refresh.md"
if ($mode -eq "task") { $promptFile = "tools/agent/prompts/04_task_execution.md" }

$promptBody = ""
if (Test-Path $promptFile) { $promptBody = Get-Content $promptFile -Raw -Encoding UTF8 }

@"
# AI BRIEFING (AUTO) - MODEL AGNOSTIC

## Session Meta
date: $today
branch: $branch
mode: $mode
task: $lastTask
domain: $domain

## Read First
1. tools/agent/SESSION_CONTEXT.md
2. tools/agent/RUNBOOK.md
3. wiki/domains/$domain.md
4. wiki/changelog/$today.md
5. $promptFile

## Git Snapshot
### status
$status

### last 5 commits
$head5

## Rules
- Tek kaynak local repo.
- Domain-aware al.
- Wiki/changelog etkisini zorunlu yaz.
- Çıktı sonunda soru sorma, "Next Action" ile devam et.

## Prompt Body
$promptBody
"@ | Out-File -FilePath $briefFile -Encoding utf8

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
@"
# STATE (AUTO)
last_run: $ts
task: $lastTask
domain: $domain
mode: $mode
branch: $branch
"@ | Out-File -FilePath $stateFile -Encoding utf8

Write-Host "[OK] go hazır. AI'ya tek dosya ver: tools/agent/AI_BRIEFING.md" -ForegroundColor Green
