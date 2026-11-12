#!/usr/bin/env python3
"""Lipește aplicația într-un singur fișier HTML (pentru publicare ca pagină Claude / artifact).

Folosire: python3 tools/build-single.py <fișier-ieșire.html>
"""
import pathlib, sys

app = pathlib.Path(__file__).resolve().parent.parent / "app"
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "portar.html")
css = (app / "style.css").read_text()
# pagina găzduită își pune singură marginile de sus/jos pentru telefon
css += "\nbody { padding-top: 0; padding-bottom: 24px; }\n"
html = f"""<title>Portar</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#07090a">
<style>
{css}</style>
<main id="app"></main>
<dialog id="sheet"></dialog>
<script>window.PORTAR_SINGLE = true;</script>
<script>
{(app / "exercises.js").read_text()}</script>
<script>
{(app / "app.js").read_text()}</script>
"""
out.write_text(html)
print(f"{out} ({len(html)} bytes)")
