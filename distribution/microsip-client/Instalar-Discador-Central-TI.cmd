@echo off
setlocal

set "CENTRAL_TI_INSTALLER=%~dp0scripts\install-microsip-dialer.ps1"
if not exist "%CENTRAL_TI_INSTALLER%" (
  echo Instalador nao encontrado. Extraia todo o pacote antes de executar.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$script = $env:CENTRAL_TI_INSTALLER; Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File ""{0}""' -f $script)"
if errorlevel 1 (
  echo A instalacao nao foi concluida. Confirme a autorizacao de administrador e tente novamente.
  pause
  exit /b 1
)

echo Instalacao concluida. Feche e abra o Chrome antes de testar a ligacao.
pause
