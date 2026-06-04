@echo off
setlocal enabledelayedexpansion

title Master Cargas - SETUP DEFINITIVO v2
chcp 65001 >nul
cls

echo ==========================================
echo   MASTER CARGAS - SETUP DEFINITIVO v2
echo ==========================================
echo.
echo [AVISO] Este terminal NAO vai fechar sozinho!
echo.

set "PROJECT_PATH=C:\Users\danie\OneDrive\Desktop\almoxarifado-master-cargas-main"
cd /d "%PROJECT_PATH%" 2>nul

if errorlevel 1 (
    echo [ERRO] Nao consegui acessar: %PROJECT_PATH%
    pause
    exit /b 1
)

echo [OK] Pasta: %CD%
echo.

:: ============================================================
::  ETAPA 1: VERIFICAR NODE.JS
:: ============================================================
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado!
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node --version') do echo [OK] Node.js %%a
echo.

:: ============================================================
::  ETAPA 2: INSTALAR DEPENDENCIAS
:: ============================================================
echo [2/5] Instalando dependencias...
echo [INFO] Isso pode demorar alguns minutos...
echo.

if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo [ERRO] npm install falhou!
        pause
        exit /b 1
    )
) else (
    echo [OK] node_modules ja existe
)

echo.
echo Instalando pacotes adicionais...
call npm install framer-motion lucide-react @tanstack/react-query clsx tailwind-merge
echo [OK] Dependencias OK
echo.

:: ============================================================
::  ETAPA 3: CRIAR ESTRUTURA DE PASTAS E ARQUIVOS
:: ============================================================
echo [3/5] Criando estrutura de arquivos...
echo.

:: Criar .env
echo - Criando .env
(
echo PORT=5000
echo HOST=0.0.0.0
echo NODE_ENV=development
) > ".env"
if not exist ".env" (
    echo [ERRO] Falha ao criar .env!
    pause
    exit /b 1
)
echo   [OK] .env criado

:: Criar pasta lib
if not exist "client\src\lib" (
    echo - Criando pasta client\src\lib
    mkdir "client\src\lib" 2>nul
    if errorlevel 1 (
        echo [ERRO] Falha ao criar pasta!
        pause
        exit /b 1
    )
)

:: CRIAR queryClient.ts (CORRETO - usando ^ para escape)
echo - Criando queryClient.ts
(
echo import { QueryClient } from "@tanstack/react-query";
echo.
echo export const queryClient = new QueryClient^({
echo   defaultOptions: ^{
echo     queries: ^{
echo       staleTime: 1000 * 60 * 5,
echo       retry: 1,
echo     ^},
echo   ^},
echo ^}^);
) > "client\src\lib\queryClient.ts"

:: Verificar se arquivo foi criado completo
findstr /C:"});" "client\src\lib\queryClient.ts" >nul
if errorlevel 1 (
    echo [ERRO] queryClient.ts foi criado incompleto!
    echo [TENTANDO METODO 2]...
    
    :: Método 2: Usar printf ou type nul
    > "client\src\lib\queryClient.ts" (
        echo import { QueryClient } from "@tanstack/react-query";
        echo.
        echo export const queryClient = new QueryClient({
        echo   defaultOptions: {
        echo     queries: {
        echo       staleTime: 1000 * 60 * 5,
        echo       retry: 1,
        echo     },
        echo   },
        echo });
    )
    
    findstr /C:"});" "client\src\lib\queryClient.ts" >nul
    if errorlevel 1 (
        echo [ERRO CRITICO] Nao consegui criar queryClient.ts corretamente!
        pause
        exit /b 1
    )
)
echo   [OK] queryClient.ts criado

:: CRIAR utils.ts (CORRETO)
echo - Criando utils.ts
(
echo import { type ClassValue, clsx } from "clsx";
echo import { twMerge } from "tailwind-merge";
echo.
echo export function cn^(...inputs: ClassValue[]^) ^{
echo   return twMerge^(clsx^(inputs^)^);
echo ^}
) > "client\src\lib\utils.ts"

findstr /C:"}" "client\src\lib\utils.ts" >nul
if errorlevel 1 (
    echo [ERRO] utils.ts incompleto, tentando metodo 2...
    > "client\src\lib\utils.ts" (
        echo import { type ClassValue, clsx } from "clsx";
        echo import { twMerge } from "tailwind-merge";
        echo.
        echo export function cn(...inputs: ClassValue[]) {
        echo   return twMerge(clsx(inputs));
        echo }
    )
)
echo   [OK] utils.ts criado

echo.
echo [OK] Todos os arquivos criados!
echo.

:: ============================================================
::  ETAPA 4: VERIFICAR ARQUIVOS
:: ============================================================
echo [4/5] Verificando arquivos...
echo.
echo Conteudo de queryClient.ts:
type "client\src\lib\queryClient.ts"
echo.
echo Conteudo de utils.ts:
type "client\src\lib\utils.ts"
echo.

echo [PAUSA] Verifique se os arquivos estao completos acima.
echo Pressione qualquer tecla para INICIAR O SERVIDOR...
pause >nul

:: ============================================================
::  ETAPA 5: INICIAR SERVIDOR
:: ============================================================
echo.
echo [5/5] Iniciando servidor...
echo.

taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

echo.
echo ==========================================
echo   INICIANDO SERVIDOR...
echo ==========================================
echo URL: http://localhost:5000
echo.

start "Master Cargas Server" cmd /k "cd /d "%CD%" && set PORT=5000 && npm run dev"

echo [INFO] Aguardando 15 segundos...
timeout /t 15 >nul

start http://localhost:5000

echo.
echo ==========================================
echo   PRONTO! 🚀
echo ==========================================
echo Login: admin / admin
echo.
echo [FIM] Pressione qualquer tecla para fechar...
pause >nul