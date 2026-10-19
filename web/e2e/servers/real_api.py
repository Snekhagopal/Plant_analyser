"""Real API for integration tests: real MobileNetV2, CLIP pest/symptom checks and Grad-CAM.

Identical to `uvicorn api.main:app` except that history goes to a temporary SQLite file instead of
data/history.db, so test runs never add entries to the real analysis history.

Run from web/:  python e2e/servers/real_api.py   (port 8102)
"""

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

import uvicorn  # noqa: E402

from src import config  # noqa: E402

config.HISTORY_DB_PATH = Path(tempfile.mkdtemp(prefix="plantvision-e2e-real-")) / "history.db"

from api.main import create_app  # noqa: E402  (reads the patched path at startup)

if __name__ == "__main__":
    uvicorn.run(create_app(), host="127.0.0.1", port=8102, log_level="warning")
