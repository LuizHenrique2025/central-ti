$ErrorActionPreference = 'Stop'

$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$databaseName = 'central_ti'
$roleName = 'central_ti_app'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot 'server\.env'

$alphabet = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789').ToCharArray()
$rolePassword = -join (1..32 | ForEach-Object { $alphabet | Get-Random })

# O psql usa a autenticação normal do administrador (prompt, .pgpass ou PGPASSFILE).
# Nunca habilite pg_hba.conf com trust durante o provisionamento.
$existingDatabase = (& $psql -W -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName'" | Out-String).Trim()
if ($existingDatabase) { throw "O banco $databaseName já existe; a criação foi interrompida para preservar os dados." }

& $psql -W -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $roleName LOGIN PASSWORD '$rolePassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT"
& $psql -W -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $databaseName OWNER $roleName"

$connection = "postgresql://$roleName`:$rolePassword@127.0.0.1:5432/$databaseName"
$existingLines = if (Test-Path $envFile) { Get-Content -LiteralPath $envFile } else { @() }
$existingLines = @($existingLines | Where-Object { $_ -notmatch '^\s*DATABASE_URL\s*=' })
Set-Content -LiteralPath $envFile -Value ($existingLines + "DATABASE_URL=$connection") -Encoding utf8
Write-Host "Banco $databaseName e usuário $roleName criados com sucesso."
