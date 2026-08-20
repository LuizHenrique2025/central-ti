param([string]$TaskName = 'Central TI')

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) { throw "A tarefa '$TaskName' não está instalada." }

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName $TaskName
Write-Host 'Tarefa Central TI reiniciada.'
