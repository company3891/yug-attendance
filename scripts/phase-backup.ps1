# ----------------------------------------------------------------------------
# Phase 完了時のバックアップを取るスクリプト
#
# 使い方:
#   pwsh -File scripts\phase-backup.ps1 -Phase 1 -Message "Phase 1 完了"
#
# 実行内容:
#   1. git add -A + commit
#   2. git tag phase-N-complete-YYYYMMDD
#   3. （リモート設定済みなら）git push --tags
#   4. backups/db/phase-N-YYYYMMDD.sql.gz に pg_dump
#   5. backups/snapshots/phase-N-YYYYMMDD/ にコード zip
# ----------------------------------------------------------------------------

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][int]$Phase,
  [string]$Message = "Phase $Phase 完了"
)

$ErrorActionPreference = 'Stop'

$proj = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $proj
$date = Get-Date -Format 'yyyyMMdd'
$tag  = "phase-$Phase-complete-$date"

Write-Host "==> Phase $Phase backup ($date)" -ForegroundColor Cyan

# 1. git add + commit
Write-Host "[1/5] git add + commit..." -ForegroundColor Yellow
git add -A
$diff = git status --porcelain
if ($diff) {
  git commit -m "feat(phase-$Phase): $Message"
} else {
  Write-Host "  (no changes to commit)" -ForegroundColor Gray
}

# 2. git tag
Write-Host "[2/5] git tag $tag..." -ForegroundColor Yellow
$existing = git tag --list $tag
if (-not $existing) {
  git tag -a $tag -m $Message
} else {
  Write-Host "  (tag already exists: $tag)" -ForegroundColor Gray
}

# 3. push (リモート設定済みなら)
Write-Host "[3/5] git push --tags..." -ForegroundColor Yellow
$hasRemote = (git remote) -ne $null
if ($hasRemote) {
  git push
  git push --tags
} else {
  Write-Host "  (no remote configured, skip)" -ForegroundColor Gray
}

# 4. DB ダンプ (pg_dump があれば)
Write-Host "[4/5] pg_dump..." -ForegroundColor Yellow
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($pgDump -and $env:DATABASE_URL) {
  $backupDir = Join-Path $proj 'backups\db'
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  $dumpFile = Join-Path $backupDir "phase-$Phase-$date.sql"
  & pg_dump $env:DATABASE_URL --no-owner --no-privileges -f $dumpFile
  Write-Host "  saved: $dumpFile" -ForegroundColor Green
} else {
  Write-Host "  (pg_dump not found or DATABASE_URL unset, skip)" -ForegroundColor Gray
  Write-Host "  alternative: Supabase Dashboard > Database > Backups から手動取得" -ForegroundColor Gray
}

# 5. コードスナップショット (zip)
Write-Host "[5/5] code snapshot zip..." -ForegroundColor Yellow
$snapDir = Join-Path $proj 'backups\snapshots'
New-Item -ItemType Directory -Path $snapDir -Force | Out-Null
$zipFile = Join-Path $snapDir "phase-$Phase-$date.zip"
$tmpDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$exclude = @('node_modules', '.next', 'backups', '.git')
Get-ChildItem -LiteralPath $proj | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $tmpDir.FullName -Recurse
}
Compress-Archive -Path "$($tmpDir.FullName)\*" -DestinationPath $zipFile -Force
Remove-Item -LiteralPath $tmpDir.FullName -Recurse -Force
Write-Host "  saved: $zipFile" -ForegroundColor Green

Write-Host "==> Done. Tag: $tag" -ForegroundColor Cyan
