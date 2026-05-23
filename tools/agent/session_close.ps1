$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

$root = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $root
$env:WIKI_BASE_REF = "origin/main"

# Strict gate: 1/true => ihlalde throw eder
$strictEnv = $env:PF_STRICT_CLOSE_GATE
$StrictGate = $true
if (-not [string]::IsNullOrWhiteSpace($strictEnv)) {
    $StrictGate = ($strictEnv -eq "1" -or $strictEnv.ToLower() -eq "true")
}

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

$today = Get-Date -Format "yyyy-MM-dd"
$changelogRel = "wiki/changelog/$today.md"
$changelogAbs = Join-Path $root $changelogRel

# STATE'den domain çek (fallback: payment-billing)
$statePath = Join-Path $root "tools/agent/STATE.md"
$domain = "payment-billing"

if (Test-Path $statePath) {
    $stateContent = Get-Content $statePath -Raw -Encoding UTF8
    $m = [regex]::Match($stateContent, "(?m)^\s*domain:\s*([a-z0-9\-_]+)\s*$")
    if ($m.Success -and $m.Groups[1].Value) {
        $domain = $m.Groups[1].Value.Trim()
    }
}

$domainRel = "wiki/domains/$domain.md"
$domainAbs = Join-Path $root $domainRel

$statusLines = @(git status --porcelain)

function Test-Touched {
    param(
        [Parameter(Mandatory = $true)][string]$RelPath,
        [Parameter(Mandatory = $true)][string[]]$Lines
    )

    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line.Length -lt 4) { continue }

        $pathPart = $line.Substring(3).Trim()

        if ($pathPart -like "* -> *") {
            $parts = $pathPart -split " -> "
            foreach ($p in $parts) {
                if ($p.Trim() -ieq $RelPath) { return $true }
            }
        } else {
            if ($pathPart -ieq $RelPath) { return $true }
        }
    }

    return $false
}

$violations = New-Object System.Collections.Generic.List[string]

# Check 1: changelog exists
if (-not (Test-Path $changelogAbs)) {
    $msg = "Gunluk changelog yok: $changelogRel"
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
    $violations.Add($msg)
} else {
    Write-Host "[OK] Changelog mevcut: $changelogRel" -ForegroundColor Green
}

# Check 2: domain file exists
if (-not (Test-Path $domainAbs)) {
    $msg = "Domain dosyasi yok: $domainRel"
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
    $violations.Add($msg)
} else {
    Write-Host "[OK] Domain dosyasi mevcut: $domainRel" -ForegroundColor Green
}

# Check 3: domain touched
$domainTouched = Test-Touched -RelPath $domainRel -Lines $statusLines
if (-not $domainTouched) {
    $msg = "Domain dosyasi touched degil: $domainRel"
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
    $violations.Add($msg)
} else {
    Write-Host "[OK] Domain dosyasi touched: $domainRel" -ForegroundColor Green
}

# Check 4: daily changelog touched
$changelogTouched = Test-Touched -RelPath $changelogRel -Lines $statusLines
if (-not $changelogTouched) {
    $msg = "Bugunku changelog touched degil: $changelogRel"
    Write-Host "[WARN] $msg" -ForegroundColor Yellow
    $violations.Add($msg)
} else {
    Write-Host "[OK] Bugunku changelog touched: $changelogRel" -ForegroundColor Green
}

# Check 5: duplicate "## Otomatik Güncelleme Kaydı"
if (Test-Path $changelogAbs) {
    $autoHeaderCount = (Select-String -Path $changelogAbs -Pattern "^## Otomatik Güncelleme Kaydı\s*$" -AllMatches).Matches.Count
    if ($autoHeaderCount -gt 1) {
        $msg = "Changelog duplicate section tespit edildi: '## Otomatik Guncelleme Kaydi' sayisi = $autoHeaderCount"
        Write-Host "[WARN] $msg" -ForegroundColor Yellow
        $violations.Add($msg)
    } else {
        Write-Host "[OK] Changelog duplicate section yok (count=$autoHeaderCount)." -ForegroundColor Green
    }
}

if ($violations.Count -gt 0) {
    Write-Host ""
    Write-Host "[VERIFY] Session Close Gate ihlalleri:" -ForegroundColor Red
    foreach ($v in $violations) {
        Write-Host " - $v" -ForegroundColor Red
    }

    if ($StrictGate) {
        throw "Session close blocked by strict gate. Ihlalleri giderip tekrar calistir."
    } else {
        Write-Host "[WARN] Strict gate kapali (PF_STRICT_CLOSE_GATE=$strictEnv). Kapanisa izin verildi." -ForegroundColor Yellow
    }
}

Write-Host "`n[OK] Session close completed."
Write-Host "Next manual step:"
Write-Host "git add . ; git commit -m 'feat: ...' (push is manual)"
Write-Host "[VERIFY] Session Close Gate: Evidence Mode tamamlandi mi? (git status + diff + risk/rollback)" -ForegroundColor Yellow
