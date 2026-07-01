@echo off
chcp 65001 >nul
cd /d "%~dp0"

set ANDROID_SERIAL=emulator-5554

echo Iniciando HCI Admin v3.4 Backup...
echo ADB alvo: %ANDROID_SERIAL%
echo.

python hci_admin_control_v3.4_backup.py

if errorlevel 1 (
    echo.
    echo ERRO: o HCI Admin v3.4 Backup nao iniciou corretamente.
    echo Verifique se o Python esta instalado, se o emulador emulator-5554 esta aberto e se o arquivo hci_admin_control_v3.4_backup.py esta na mesma pasta deste .bat.
    echo.
    pause
)
