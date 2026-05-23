@echo off
rem ============================================================
rem YUG Attendance 開発サーバー起動スクリプト
rem このウィンドウを閉じるとサーバーも止まります。
rem ============================================================
cd /d "%~dp0\.."
title YUG Attendance Dev Server [このウィンドウは閉じない]

echo === 既存の node プロセスを掃除 ===
taskkill /F /IM node.exe 2>nul

echo === 開発サーバー起動 ===
echo URL: http://localhost:3000
echo.
call npm run dev

echo.
echo *** サーバーが終了しました ***
pause
