$ErrorActionPreference = 'Stop'
Stop-ScheduledTask -TaskName 'Central TI' -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName 'Central TI'
Write-Host 'Tarefa Central TI reiniciada.'
