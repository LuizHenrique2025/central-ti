$ErrorActionPreference = 'Stop'

$serviceName = 'postgresql-x64-18'
$dataDirectory = 'C:\Program Files\PostgreSQL\18\data'
$hbaFile = Join-Path $dataDirectory 'pg_hba.conf'
$hbaBackup = Join-Path $dataDirectory 'pg_hba.conf.central-ti-backup-2026-08-15'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$databaseName = 'central_ti'
$roleName = 'central_ti_app'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot 'server\.env'

if (-not (Test-Path $hbaBackup)) { Copy-Item -LiteralPath $hbaFile -Destination $hbaBackup -ErrorAction Stop }

$alphabet = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789').ToCharArray()
$rolePassword = -join (1..32 | ForEach-Object { $alphabet | Get-Random })
$temporaryRule = "# CENTRAL TI TEMPORARY PROVISIONING - REMOVE AFTER USE`r`nhost    postgres        postgres        127.0.0.1/32            trust`r`n"

try {
  $original = Get-Content -LiteralPath $hbaFile -Raw
  Set-Content -LiteralPath $hbaFile -Value ($temporaryRule + $original) -Encoding ascii
  Restart-Service -Name $serviceName -Force
  Start-Sleep -Seconds 2

  $existingDatabase = (& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName'" | Out-String).Trim()
  if ($existingDatabase) { throw "O banco $databaseName já existe; a criação foi interrompida para preservar os dados." }

  & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $roleName LOGIN PASSWORD '$rolePassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT"
  & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $databaseName OWNER $roleName"

  $connection = "postgresql://$roleName`:$rolePassword@127.0.0.1:5432/$databaseName"
  $existingLines = if (Test-Path $envFile) { Get-Content -LiteralPath $envFile } else { @() }
  $existingLines = @($existingLines | Where-Object { $_ -notmatch '^\s*DATABASE_URL\s*=' })
  Set-Content -LiteralPath $envFile -Value ($existingLines + "DATABASE_URL=$connection") -Encoding utf8
  Write-Host "Banco $databaseName e usuário $roleName criados com sucesso."
}
finally {
  Copy-Item -LiteralPath $hbaBackup -Destination $hbaFile -Force
  Restart-Service -Name $serviceName -Force
}
