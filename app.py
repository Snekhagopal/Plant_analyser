"""AI Plant Health Assistant - Streamlit entry point.

Run with:  streamlit run app.py
"""

from __future__ import annotations

import logging

import streamlit as st

from src import config
from src.database.history import HistoryError, HistoryStore
from src.inference.analysis import LEAF_CLOSE_UP, PHOTO_TYPES
from src.inference.model import ModelLoadError
from src.inference.predictor import PlantDiseasePredictor, load_thresholds
from src.plants.care_profiles import profile_names
from src.plants.catalog import OTHER_OPTION, PLANTVILLAGE_LABELS, PlantCatalog
from src.recommendations import context as q
from src.service import run_full_analysis
from src.ui import components as ui
from src.ui.styles import CSS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("plant_health_app")

st.set_page_config(page_title="AI Plant Health Assistant", page_icon="🌱", layout="wide")


@st.cache_resource(show_spinner="Loading the plant disease model…")
def get_predictor():
    try:
        return PlantDiseasePredictor(), None
    except ModelLoadError as exc:
        logger.error("Model load failed: %s", exc)
        return None, "The disease model could not be loaded. Only general guidance is available."
    except Exception:
        logger.exception("Unexpected model load failure")
        return None, "The disease model could not be loaded. Only general guidance is available."


@st.cache_resource
def get_history():
    try:
        return HistoryStore(config.HISTORY_DB_PATH)
    except HistoryError as exc:
        logger.error("History unavailable: %s", exc)
        return None


def plant_options(catalog: PlantCatalog) -> list[str]:
    names = set(catalog.display_names()) | set(profile_names())
    return sorted(names, key=str.lower) + [OTHER_OPTION]


def plant_name_input(catalog: PlantCatalog) -> str:
    def label(name: str) -> str:
        return f"{name} · disease check" if catalog.match(name).supported else name

    choice = st.selectbox(
        "Plant name *",
        plant_options(catalog),
        index=None,
        format_func=label,
        placeholder="Search 140+ plants or type your plant's name…",
        accept_new_options=True,
        help="Required. Plants marked 'disease check' are covered by the disease model; all plants get "
             f"pest screening and care guidance. Pick '{OTHER_OPTION}' or type any other name.",
    )
    st.caption(f"Disease check available for {len(catalog.species)} crops; pest screening and care guidance "
               "for all plants.")
    if choice == OTHER_OPTION:
        return st.text_input("Which plant is it? *", max_chars=80, placeholder="e.g. Peace lily, Basil, Rose")
    return choice or ""


def questionnaire() -> q.CareContext:
    with st.expander("Optional: symptoms and care conditions (improves watering, pest and nutrient advice)"):
        symptoms = st.multiselect("Symptoms you can see", q.SYMPTOM_OPTIONS)
        c1, c2 = st.columns(2)
        with c1:
            soil = st.selectbox("Soil moisture 3-5 cm deep", q.SOIL_MOISTURE)
            freq = st.selectbox("Watering frequency", q.WATERING_FREQUENCY)
            drainage = st.selectbox("Drainage", q.DRAINAGE)
            location = st.selectbox("Where is the plant growing?", q.LOCATION)
            affected = st.selectbox("Which leaves are affected?", q.AFFECTED_LEAVES)
        with c2:
            sun = st.selectbox("Sunlight", q.SUNLIGHT)
            weather = st.selectbox("Recent weather", q.WEATHER)
            fert = st.selectbox("Last fertiliser", q.FERTILIZER)
            insects = st.selectbox("Insects visible on the plant?", q.INSECTS)
    return q.CareContext(symptoms=symptoms, soil_moisture=soil, watering_frequency=freq, drainage=drainage,
                         location=location, sunlight=sun, weather=weather, fertilizer=fert,
                         insects_visible=insects, affected_leaves=affected)


def analyze_tab(predictor, model_error, catalog, thresholds, history):
    if model_error:
        st.error(model_error)

    left, right = st.columns([1, 1], gap="large")
    with left:
        uploaded = st.file_uploader(
            "Plant or leaf photo *", type=sorted(config.ALLOWED_EXTENSIONS),
            help=f"JPG, PNG or WebP, up to {config.MAX_UPLOAD_MB} MB. A leaf close-up or the whole plant; for a disease "
                 "check, one affected leaf in daylight, filling the frame, works best.",
        )
        if uploaded is not None:
            st.image(uploaded, caption="Preview", width="stretch")
    with right:
        plant_name = plant_name_input(catalog)
        photo_type = st.radio(
            "What does the photo show?", list(PHOTO_TYPES), format_func=PHOTO_TYPES.get, horizontal=True,
            index=list(PHOTO_TYPES).index(LEAF_CLOSE_UP),
            help="Disease checks are most reliable on a close-up of one affected leaf. Whole-plant photos are "
                 "accepted, but their disease result is shown as uncertain at most.",
        )
        ctx = questionnaire()
        clicked = st.button("🔍 Analyze plant", type="primary", width="stretch")

    if clicked:
        errors = []
        if uploaded is None:
            errors.append("Please upload a photo of the plant or leaf.")
        if not plant_name.strip():
            errors.append("Please enter or select the plant name - it is required.")
        if errors:
            for e in errors:
                st.warning(e)
            st.session_state.pop("bundle", None)
        else:
            with st.spinner("Analysing the photo…"):
                st.session_state["bundle"] = run_full_analysis(
                    uploaded.getvalue(), uploaded.name, plant_name, ctx,
                    predictor, catalog, thresholds, history, photo_type=photo_type,
                )

    bundle = st.session_state.get("bundle")
    if bundle is not None:
        st.divider()
        st.header("Results")
        ui.render_results(bundle, catalog)


def main():
    st.markdown(CSS, unsafe_allow_html=True)
    ui.hero()

    predictor, model_error = get_predictor()
    if predictor is not None:
        catalog, thresholds = predictor.catalog, predictor.thresholds
    else:
        catalog, thresholds = PlantCatalog(PLANTVILLAGE_LABELS), load_thresholds()
    history = get_history()

    tab_analyze, tab_history, tab_about = st.tabs(["🔍 Analyze", "🕘 History", "ℹ️ About the model"])
    with tab_analyze:
        analyze_tab(predictor, model_error, catalog, thresholds, history)
    with tab_history:
        ui.render_history(history)
    with tab_about:
        ui.render_about(catalog)


main()
