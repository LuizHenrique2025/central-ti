$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$helper = Join-Path $projectRoot 'tools\microsip_dialer.py'

if (-not (Test-Path -LiteralPath $helper)) { throw "Auxiliar não encontrado: $helper" }

$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) { throw 'Python não foi encontrado. Instale o Python 3 antes de configurar o discador.' }

& $python.Source -3 $helper --install
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível registrar a integração com o MicroSIP.' }

Write-Host 'Integração instalada. Abra a Central TI e clique em Ligar na área de Ramais.'
