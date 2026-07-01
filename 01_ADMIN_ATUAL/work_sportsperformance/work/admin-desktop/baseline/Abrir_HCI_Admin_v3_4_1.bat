@echo off
chcp 65001 >nul
cd /d "%~dp0"

set ANDROID_SERIAL=emulator-5554

echo Iniciando HCI Admin v3.4.1...
echo ADB alvo: %ANDROID_SERIAL%
echo.

python hci_admin_control_v3.4.1.py

if errorlevel 1 (
    echo.
    echo ERRO: o HCI Admin v3.4.1 nao iniciou corretamente.
    echo Verifique se o Python esta instalado, se o emulador emulator-5554 esta aberto e se o arquivo hci_admin_control_v3.4.1.py esta na mesma pasta deste .bat.
    echo.
    pause
)
