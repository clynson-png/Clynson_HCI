@echo off
setlocal
cd /d "%~dp0"

set "SCRIPT=HCI_ADMIN_V44_LAYOUT_ESTAVEL.py"
set "ADMIN_URL=http://127.0.0.1:8772"
set "PY_CMD="
set "PY_ARGS="
echo ===============================================
echo HCI ADMIN v4.4 - LAYOUT ESTAVEL + MOTORES
echo ===============================================
echo Pasta: %CD%
echo.

if exist "C:\Program Files\Python314\python.exe" (
    set "PY_CMD=C:\Program Files\Python314\python.exe"
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        set "PY_CMD=py"
        set "PY_ARGS=-3"
    ) else (
        where python >nul 2>nul
        if %errorlevel%==0 (
            set "PY_CMD=python"
        )
    )
)

if not defined PY_CMD (
    echo ERRO: Python nao encontrado.
    echo Verifique o PATH ou instale Python.
    goto :end
)

echo Python: %PY_CMD% %PY_ARGS%
echo Script: %SCRIPT%
echo URL: %ADMIN_URL%
echo.
echo Iniciando Admin...

if defined PY_ARGS (
    "%PY_CMD%" %PY_ARGS% "%SCRIPT%"
) else (
    "%PY_CMD%" "%SCRIPT%"
)

echo.
echo Admin encerrado.
echo Se a janela do browser nao abrir sozinha, use:
echo   %ADMIN_URL%

echo.
echo ===============================================
echo Launcher finalizado.
echo ===============================================
:end
pause
endlocal
