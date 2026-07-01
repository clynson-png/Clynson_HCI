@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo HCI ADMIN v4.3 - LAYOUT ESTAVEL + MOTORES
echo ===============================================
echo Pasta: %CD%
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py -3 HCI_ADMIN_V43_LAYOUT_ESTAVEL.py
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        python HCI_ADMIN_V43_LAYOUT_ESTAVEL.py
    ) else (
        echo ERRO: Python nao encontrado no PATH.
        echo Instale Python ou abra pelo ambiente onde o Admin funcionava.
    )
)

echo.
echo ===============================================
echo Se apareceu erro acima, copie e me envie.
echo ===============================================
pause
endlocal
