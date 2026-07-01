@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Iniciando HCI Admin v4.2 - Motores Conectados...
echo.

python hci_admin_control_v4.2_motores_conectados.py

if errorlevel 1 (
    echo.
    echo ERRO: o HCI Admin nao iniciou corretamente.
    echo Verifique se o Python esta instalado e se o arquivo .py esta na mesma pasta deste .bat.
    echo.
    pause
)
