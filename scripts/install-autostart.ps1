param(
  [string]$TaskName = 'Central TI',
  [ValidateRange(1, 65535)][int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot 'scripts\start-central-ti.cmd'

if (-not (Test-Path $launcher)) { throw 'Inicializador da Central TI não foi encontrado.' }

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  $commandLine = [string]$process.CommandLine
  if ($commandLine -notlike "*$projectRoot*") {
    throw "A porta $Port já está sendo usada pelo processo $($listener.OwningProcess). A tarefa não foi instalada para evitar encerrar outro aplicativo."
  }
  Stop-Process -Id $listener.OwningProcess -Force
}

$action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument ('/d /c ""{0}""' -f $launcher) -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Inicia a Central TI automaticamente quando o Windows ligar.' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host 'Tarefa Central TI criada e iniciada.'
