@echo off
title MASTER CARGAS START - FIX WINDOWS
color 0A
cls

:: Forca o caminho correto
cd /d %~dp0

echo 1. LIMPANDO CACHE E PORTAS...
taskkill /F /IM node.exe /T >nul 2>&1
if exist node_modules\.vite rmdir /s /q node_modules\.vite
timeout /t 2 /nobreak >nul

echo 2. INJETANDO VARIAVEIS NO WINDOWS...
:: Aqui resolvemos o erro do NODE_ENV
set "NODE_ENV=development"
set "DATABASE_URL=postgresql://postgres:120605@localhost:5432/master_cargas_devdaniel"
set "PORT=5001"

echo 3. INICIANDO SERVIDOR...
start http://localhost:5001

:: Em vez de "npm run dev", vamos chamar o comando direto para pular o erro do script
call npx tsx server/index.ts

echo.
echo Se o servidor parou, o erro apareceu acima.
pause
