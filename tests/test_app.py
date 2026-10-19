"""Streamlit smoke tests using the built-in AppTest harness."""

from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

from tests.conftest import requires_checkpoint

APP = str(Path(__file__).resolve().parents[1] / "app.py")


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setattr("src.config.HISTORY_DB_PATH", tmp_path / "history.db")
    import streamlit as st
    st.cache_resource.clear()  # never reuse a store pointing at another path
    at = AppTest.from_file(APP, default_timeout=60)
    at.run()
    return at


@requires_checkpoint
def test_app_renders_without_exceptions(app):
    assert not app.exception
    assert any("Analyze plant" in b.label for b in app.button)
    assert app.selectbox[0].label.startswith("Plant name")


@requires_checkpoint
def test_analyze_without_inputs_shows_validation(app):
    next(b for b in app.button if "Analyze plant" in b.label).click().run()
    assert not app.exception
    messages = [w.value for w in app.warning]
    assert any("upload a photo" in m for m in messages)
    assert any("plant name" in m for m in messages)


@requires_checkpoint
def test_plant_selector_lists_supported_plants_and_other(app):
    options = app.selectbox[0].options
    assert "Tomato · disease check" in options and "Other / Not listed" in options
    assert "Hibiscus" in options and "Pothos" in options and len(options) > 140


@requires_checkpoint
@pytest.mark.parametrize("image_name,plant", [
    ("sample_leaf.jpg", "Peach"),
    ("image.png", "Tomato"),
    ("image.png", "Peace lily"),
    ("sample_leaf.jpg", "Other / Not listed"),
    ("tests/fixtures/whitefly_tomato_leaf.jpg", "Tomato"),
    ("tests/fixtures/whitefly_tomato_leaf.jpg", "Hibiscus"),
])
def test_results_section_renders_for_real_analyses(app, image_name, plant):
    """Inject a real analysis bundle and render the full results UI."""
    from src import config
    from src.inference.predictor import PlantDiseasePredictor
    from src.service import run_full_analysis

    path = config.ROOT / image_name if "/" in image_name else config.DATA_DIR / image_name
    if not path.exists():
        pytest.skip(f"{image_name} not available")
    predictor = PlantDiseasePredictor()
    bundle = run_full_analysis(path.read_bytes(), image_name, plant, None, predictor,
                               predictor.catalog, predictor.thresholds)
    app.session_state["bundle"] = bundle
    app.run()
    assert not app.exception
    assert any("What to do next" in s.value for s in app.subheader)
    if bundle.result.shows_candidate:
        assert bundle.gradcam is not None and bundle.gradcam.ok


@requires_checkpoint
def test_history_tab_renders_saved_entries(tmp_path, monkeypatch):
    from src.database.history import HistoryStore
    db = tmp_path / "history.db"
    HistoryStore(db).add("Tomato", "uncertain", "Uncertain prediction", "summary",
                         {"summary": "s", "sections": [{"title": "Actions", "items": ["a"]}]})
    monkeypatch.setattr("src.config.HISTORY_DB_PATH", db)
    import streamlit as st
    st.cache_resource.clear()  # get_history() is cached per process
    at = AppTest.from_file(APP, default_timeout=60)
    at.run()
    assert not at.exception
    assert any(df.value.shape[0] >= 1 for df in at.dataframe)
