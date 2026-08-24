"""Abre o MicroSIP para chamar um ramal solicitado pela Central TI.

Instale o protocolo uma vez por usuário com:
    py tools/microsip_dialer.py --install
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

SCHEME = "centralti-microsip"
VALID_EXTENSION = re.compile(r"^\d{2,6}$")


def microsip_candidates() -> list[Path]:
    configured = os.environ.get("MICROSIP_PATH")
    locations = [
        configured,
        r"C:\Program Files\MicroSIP\microsip.exe",
        r"C:\Program Files (x86)\MicroSIP\microsip.exe",
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "MicroSIP" / "microsip.exe"),
    ]
    return [Path(location) for location in locations if location]


def find_microsip() -> Path | None:
    return next((path for path in microsip_candidates() if path.is_file()), None)


def extension_from_uri(uri: str) -> str | None:
    parsed = urlparse(uri)
    if parsed.scheme.lower() != SCHEME or parsed.netloc.lower() != "call":
        return None
    extension = unquote(parsed.path).strip("/")
    return extension if VALID_EXTENSION.fullmatch(extension) else None


def dial(uri: str) -> int:
    extension = extension_from_uri(uri)
    if not extension:
        print("Pedido de ligação inválido.", file=sys.stderr)
        return 2
    microsip = find_microsip()
    if not microsip:
        print("MicroSIP não foi encontrado. Defina MICROSIP_PATH ou instale-o no caminho padrão.", file=sys.stderr)
        return 3
    subprocess.Popen([str(microsip), extension], close_fds=True)
    return 0


def install_protocol() -> int:
    if os.name != "nt":
        print("O protocolo do MicroSIP só pode ser instalado no Windows.", file=sys.stderr)
        return 4
    import winreg
    command = f'"{sys.executable}" "{Path(__file__).resolve()}" "%1"'
    key_path = rf"Software\Classes\{SCHEME}"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "Central TI MicroSIP Call")
        winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path + r"\shell\open\command") as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, command)
    print("Integracao Central TI para MicroSIP instalada para este usuario.")
    return 0


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "--install":
        return install_protocol()
    if len(sys.argv) == 2 and sys.argv[1] == "--check":
        microsip = find_microsip()
        print(str(microsip) if microsip else "MicroSIP não encontrado.")
        return 0 if microsip else 3
    if len(sys.argv) == 2:
        return dial(sys.argv[1])
    print("Uso: microsip_dialer.py --install | --check | centralti-microsip://call/204", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
