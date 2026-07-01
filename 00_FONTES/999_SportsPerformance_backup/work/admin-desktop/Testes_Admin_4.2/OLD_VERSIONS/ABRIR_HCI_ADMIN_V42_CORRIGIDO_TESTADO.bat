@echo off
cd /d "%~dp0"
title HCI ADMIN V4.2 CORRIGIDO - PORTA 8767
echo ===============================================
echo HCI ADMIN V4.2 CORRIGIDO - PORTA 8767
echo Arquivo: HCI_ADMIN_V42_CORRIGIDO_TESTADO.py
echo URL: http://127.0.0.1:8767
echo ===============================================
echo.
py HCI_ADMIN_V42_CORRIGIDO_TESTADO.py
if errorlevel 1 (
  echo.
  echo ERRO AO ABRIR. COPIE A MENSAGEM ACIMA.
  pause
)
