from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


_backend = None


def _load_backend():
    global _backend
    if _backend is None:
        backend_path = Path(__file__).resolve().parent.parent / "app.py"
        spec = spec_from_file_location("_vidyora_backend", backend_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load Flask application from {backend_path}")
        _backend = module_from_spec(spec)
        spec.loader.exec_module(_backend)
    return _backend


def __getattr__(name):
    if name == "app":
        return _load_backend().app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def create_app():
    return _load_backend().app
