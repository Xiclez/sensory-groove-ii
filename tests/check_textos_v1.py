#!/usr/bin/env python3
"""Verifica que el texto en español de la V1 se preservo literalmente.

Extrae las cadenas visibles de refs/index.html y confirma que cada una sigue
presente en el frontend de la V2, sin correcciones ortograficas ni cambios de
jerga. Uso:

    python3 tests/check_textos_v1.py
"""

import re
import sys
from html import unescape
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
REF = RAIZ / "refs" / "index.html"
FUENTES = [
    RAIZ / "frontend" / "src" / "pages" / "FlyerPage.jsx",
    RAIZ / "frontend" / "src" / "data" / "lineup.js",
    RAIZ / "frontend" / "src" / "components" / "DjModal.jsx",
    RAIZ / "frontend" / "index.html",
]

# Cadenas de la V1 ligadas al flujo de WhatsApp que la V2 sustituye a proposito
# por el formulario de ticketing (ver Fase 1 del brief).
OMITIDAS_A_PROPOSITO = {
    "Enviar Comprobante via WhatsApp ▼",
    "Enviar a De La Reiver",
    "Enviar a Tota",
    "DJ NAME",
    "Descripción del DJ.",
}


def normaliza(texto: str) -> str:
    """Colapsa espacios: JSX y HTML no preservan el formato original."""
    return re.sub(r"\s+", " ", unescape(texto)).strip()


def extrae_textos_visibles(html: str) -> list[str]:
    # Fuera comentarios, <style> y <script>: no son texto visible.
    cuerpo = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    cuerpo = re.sub(r"<(style|script)\b.*?</\1>", " ", cuerpo, flags=re.S)

    textos = []
    # 1. Nodos de texto entre etiquetas.
    for trozo in re.split(r"<[^>]+>", cuerpo):
        t = normaliza(trozo)
        if t and re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ¡!¿?]", t):
            textos.append(t)

    # 2. Cadenas dentro de las llamadas a openModal(...) del onclick.
    for llamada in re.findall(r"openModal\((.*?)\)\"", cuerpo, flags=re.S):
        for cadena in re.findall(r"'([^']*)'", llamada):
            t = normaliza(cadena)
            if t and not t.startswith("http"):
                textos.append(t)

    return textos


def main() -> int:
    if not REF.is_file():
        print(f"No se encontro {REF}")
        return 2

    referencia = REF.read_text(encoding="utf-8")
    objetivo = normaliza(
        "\n".join(f.read_text(encoding="utf-8") for f in FUENTES if f.is_file())
    )

    faltantes = []
    revisadas = 0
    for texto in extrae_textos_visibles(referencia):
        if texto in OMITIDAS_A_PROPOSITO or len(texto) < 3:
            continue
        revisadas += 1
        if texto not in objetivo:
            faltantes.append(texto)

    print(f"Cadenas de la V1 revisadas: {revisadas}")
    if faltantes:
        print(f"\nFALTAN O FUERON ALTERADAS ({len(faltantes)}):")
        for texto in faltantes:
            print(f"  - {texto!r}")
        return 1

    print("OK: todo el texto en español de la V1 se conserva literalmente.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
