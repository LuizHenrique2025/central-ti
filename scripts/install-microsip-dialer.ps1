param(
  [string[]]$AllowedOrigin = @(
    'http://192.168.2.80:3000',
    'http://172.20.192.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001'
  )
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$helper = Join-Path $projectRoot 'tools\microsip_dialer.py'

if (-not (Test-Path -LiteralPath $helper)) { throw "Auxiliar não encontrado: $helper" }

$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) { throw 'Python não foi encontrado. Instale o Python 3 antes de configurar o discador.' }

& $python.Source -3 $helper --install
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível registrar a integração com o MicroSIP.' }

$policyPath = 'HKCU:\Software\Policies\Google\Chrome\AutoLaunchProtocolsFromOrigins'
try {
  New-Item -Path $policyPath -Force | Out-Null
} catch {
  throw 'A política do Chrome exige uma execução elevada neste computador. Abra o PowerShell como administrador e execute o instalador novamente.'
}

$entry = @{ protocol = 'centralti-microsip'; allowed_origins = @($AllowedOrigin | Where-Object { $_ }) } | ConvertTo-Json -Compress
$existingValues = (Get-ItemProperty -LiteralPath $policyPath).PSObject.Properties | Where-Object { $_.Name -match '^\d+$' } | Select-Object -ExpandProperty Value
if ($existingValues -notcontains $entry) {
  $index = 1
  while ($null -ne (Get-ItemProperty -LiteralPath $policyPath -Name "$index" -ErrorAction SilentlyContinue)) { $index++ }
  New-ItemProperty -LiteralPath $policyPath -Name "$index" -Value $entry -PropertyType String | Out-Null
}

Write-Host 'Integração instalada. Reinicie o Chrome para aplicar a abertura direta do MicroSIP nas origens autorizadas.'
