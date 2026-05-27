param(
 [ValidateSet("bootstrap","refresh","task","docs","closeout")]
 [string]$Mode = "bootstrap",
 [string]$Task = "Genel geliştirme",
 [string]$Domain = "general"
)

$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$root = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $root

$today = Get-Date -Format "yyyy-MM-dd"
$brief = "tools/agent/AI_BRIEFING.md"
$ctx = "tools/agent/SESSION_CONTEXT.md"

$promptMap = @{
 "bootstrap" = "tools/agent/prompts/01_session_bootstrap.md"
 "refresh" = "tools/agent/prompts/02_session_refresh.md"
 "docs" = "tools/agent/prompts/03_docs_migration.md"
 "task" = "tools/agent/prompts/04_task_execution.md"
 "closeout" = "tools/agent/prompts/05_session_closeout.md"
}
$promptFile = $promptMap[$Mode]

if (!(Test-Path $promptFile)) { throw "Prompt file not found: $promptFile" }

$branch = git rev-parse --abbrev-ref HEAD
$status = git status --short | Out-String
$head5 = git log --oneline -n 5 | Out-String

@"
# AI BRIEFING (AUTO-GENERATED) DO NOT COMMIT

## Meta
- Mode: $Mode
- Task: $Task
- Domain: $Domain
- Date: $today
- Branch: $branch

## Required Read Order
1. $ctx
2. tools/agent/RUNBOOK.md
3. wiki/domains/$Domain.md
4. wiki/changelog/$today.md
5. $promptFile

## Git Snapshot
### git status --short
$status

### last 5 commits
$head5

---

## PROMPT CONTENT (from $promptFile)

$(Get-Content $promptFile -Raw -Encoding UTF8)

"@ | Out-File -FilePath $brief -Encoding utf8

Write-Host "[OK] AI briefing generated: $brief"
