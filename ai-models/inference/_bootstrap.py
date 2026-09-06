"""
_bootstrap.py
─────────────────────────────────────────────────────────────────────────────
Initializes module resolution and imports for hyphenated package directories
in /ai-models (priority-engine, traffic-predictor, block-optimizer, training).
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import importlib.util
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
WORKSPACE_DIR = AI_MODELS_DIR.parent

# Ensure directories are in sys.path
for d in [WORKSPACE_DIR, AI_MODELS_DIR]:
    if str(d) not in sys.path:
        sys.path.insert(0, str(d))

# Register hyphenated directories into sys.modules with standard python package aliases
HYPHENATED_PACKAGES = [
    ("priority_engine", "priority-engine"),
    ("traffic_predictor", "traffic-predictor"),
    ("block_optimizer", "block-optimizer"),
    ("training", "training"),
    ("shared", "shared"),
]

for pkg_name, folder_name in HYPHENATED_PACKAGES:
    pkg_path = AI_MODELS_DIR / folder_name
    if pkg_path.exists():
        if str(pkg_path) not in sys.path:
            sys.path.insert(0, str(pkg_path))
        init_file = pkg_path / "__init__.py"
        if pkg_name not in sys.modules and init_file.exists():
            spec = importlib.util.spec_from_file_location(
                pkg_name,
                str(init_file),
                submodule_search_locations=[str(pkg_path)],
            )
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                sys.modules[pkg_name] = mod
                try:
                    spec.loader.exec_module(mod)
                except Exception:
                    pass
