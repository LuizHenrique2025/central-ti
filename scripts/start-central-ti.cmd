@echo off
setlocal
cd /d "%~dp0.."

if not exist "logs" mkdir "logs"
echo [%date% %time%] Iniciando Central TI >> "logs\central-ti-autostart.log"
"C:\Program Files\nodejs\npm.cmd" start >> "logs\central-ti-autostart.log" 2>&1
echo [%date% %time%] Processo Central TI encerrado com código %errorlevel% >> "logs\central-ti-autostart.log"
