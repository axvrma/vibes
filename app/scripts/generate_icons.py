#!/usr/bin/env python3
"""Compatibility entrypoint for the canonical Vibes vector-based asset generator."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[2]
subprocess.run(['node', str(root / 'scripts/generate-brand.mjs')], cwd=root, check=True)
print('Run dart run flutter_launcher_icons and dart run flutter_native_splash:create in app/.')
