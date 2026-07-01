@echo off
cd /d "%~dp0"
echo ===============================================
echo HCI ADMIN V4.2 - HTML ORIGINAL + TARGETSCAN
echo ===============================================
py HCI_ADMIN_V42_HTML_ORIGINAL_TARGETSCAN.py
if errorlevel 1 (
  echo.
  echo ERRO AO ABRIR. COPIE A MENSAGEM ACIMA.
  pause
)
