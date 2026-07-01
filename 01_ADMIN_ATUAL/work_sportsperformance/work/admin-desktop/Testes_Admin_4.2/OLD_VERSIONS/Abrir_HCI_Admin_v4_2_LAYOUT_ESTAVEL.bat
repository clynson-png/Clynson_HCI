@echo off
setlocal
cd /d "%~dp0"
echo Abrindo HCI Admin v4.2 - layout preservado + motores conectados...
echo.
py -3 hci_admin_control_v4.2_layout_conectado_estavel.py
if errorlevel 1 (
  echo.
  echo O Admin encontrou um erro. A janela ficara aberta para leitura.
  pause
)
endlocal
