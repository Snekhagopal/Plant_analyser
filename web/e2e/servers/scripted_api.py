"""Controlled API for deterministic UI tests (Playwright).

Runs the real FastAPI app (api/main.py) and the real pipeline - upload validation, quality checks, plant
matching, reliability rules, recommendations, treatment gating, report and Grad-CAM on the real
MobileNetV2 - but the classifier's *scores* (and the CLIP pest/symptom outputs) come from a scenario
the test sets via POST /__test__/scenario. It never claims to be real inference: tests that validate
the real model use real_api.py instead.

History goes to a temporary SQLite file, never data/history.db.

Run from web/:  python e2e/servers/scripted_api.py   (port 8101)
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
import uvicorn  # noqa: E402
from fastapi import Request  # noqa: E402

from api.main import create_app  # noqa: E402
from src import config  # noqa: E402
from src.database.history import HistoryStore  # noqa: E402
from src.inference.model import load_mobilenet_checkpoint  # noqa: E402
from src.inference.predictor import ModelOutput, load_thresholds  # noqa: E402
from src.inference.symptom_screen import SymptomResult  # noqa: E402
from src.plants.catalog import PlantCatalog  # noqa: E402
from src.utils.preprocessing import build_transform  # noqa: E402

PORT = 8101
DEFAULT = {"weights": {"Tomato___Early_blight": 0.97}, "ood_score": 10.0, "pest_score": 0.05,
           "pest_top": [], "symptom": None, "raises": False, "model": True}


class ScriptedPredictor:
    """Real MobileNetV2 (for preprocessing and Grad-CAM) with scripted output scores."""

    def __init__(self):
        loaded = load_mobilenet_checkpoint(config.MOBILENET_CHECKPOINT)
        self.model, self.class_names = loaded.model, loaded.class_names
        self.transform = build_transform(loaded.image_size, loaded.mean, loaded.std)
        self.catalog = PlantCatalog(self.class_names)
        self.thresholds = load_thresholds()
        self.image_size = loaded.image_size
        self.pest_screen = None
        self.symptom_screen = None
        self.scenario = dict(DEFAULT)

    def preprocess(self, image):
        return self.transform(image.convert("RGB")).unsqueeze(0)

    def predict(self, image):
        s = self.scenario
        if s["raises"]:
            raise RuntimeError("scripted inference failure")
        n = len(self.class_names)
        weights = s["weights"]
        probs = np.full(n, (1.0 - sum(weights.values())) / (n - len(weights)))
        for label, w in weights.items():
            probs[self.class_names.index(label)] = w
        order = np.argsort(probs)[::-1][:3]
        symptom = None
        if s["symptom"]:
            sym = s["symptom"]   # {"key", "p", optional "clear", "second", "p2"}
            scores = {sym["key"]: sym["p"]}
            if sym.get("second"):
                scores[sym["second"]] = sym.get("p2", sym["p"] - 0.01)
            symptom = SymptomResult(sym["key"], sym["p"], scores, clear=sym.get("clear", True), second=sym.get("second"))
        return ModelOutput(probs, probs, [(self.class_names[i], float(probs[i])) for i in order],
                           ood_score=s["ood_score"], pest_score=s["pest_score"],
                           pest_top=[tuple(x) for x in s["pest_top"]], pest_method="clip", symptom=symptom)


def build():
    predictor = ScriptedPredictor()
    history = HistoryStore(Path(tempfile.mkdtemp(prefix="plantvision-e2e-")) / "history.db")
    app = create_app(predictor=predictor, history=history)

    @app.post("/__test__/scenario")
    async def set_scenario(request: Request):
        """Test-only: set the scripted model output for the next analyses."""
        body = await request.json()
        predictor.scenario = {**DEFAULT, **body}
        request.app.state.predictor = predictor if predictor.scenario["model"] else None
        return {"ok": True}

    return app


if __name__ == "__main__":
    uvicorn.run(build(), host="127.0.0.1", port=PORT, log_level="warning")
