"""
model_loader.py
─────────────────────────────────────────────────────────────────────────────
Static analysis and direct import forwarding shim for priority-engine/model_loader.py.
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import importlib.util

_SRC_DIR = Path(__file__).resolve().parent.parent / "priority-engine"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

_target_file = _SRC_DIR / "model_loader.py"
_spec = importlib.util.spec_from_file_location("priority_engine.model_loader", str(_target_file))
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    ModelLoader = _mod.ModelLoader
    model_loader = _mod.model_loader
    __all__ = ["ModelLoader", "model_loader"]
else:
    class ModelLoader:  # type: ignore
        pass
    model_loader = None  # type: ignore
    __all__ = ["ModelLoader", "model_loader"]
