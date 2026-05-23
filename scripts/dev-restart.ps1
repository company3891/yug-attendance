# 開発サーバーをリスタートする（落ちたとき用）
# 使い方: PowerShell から右クリック → 「PowerShell で実行」
# または:  pwsh -File scripts\dev-restart.ps1

$ErrorActionPreference = 'Continue'
$proj = Split-Path -Parent $PSScriptRoot

Write-Host "==> 既存 node プロセス掃除..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "==> 開発サーバー起動..." -ForegroundColor Yellow
Set-Location -LiteralPath $proj

# 新ウィンドウで npm run dev を起動（ウィンドウを閉じるまで動き続ける）
Start-Process -FilePath 'cmd.exe' -ArgumentList '/k','title YUG Attendance Dev [このウィンドウは閉じない] && npm run dev' -WorkingDirectory $proj

Write-Host "==> 起動完了。URL: http://localhost:3000" -ForegroundColor Green
Write-Host "    新しく開いた黒いウィンドウは閉じないでください。" -ForegroundColor Cyan
