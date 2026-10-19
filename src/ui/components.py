"""Streamlit rendering helpers for results, history and model information."""

from __future__ import annotations

import html
import json
from datetime import datetime

import pandas as pd
import streamlit as st

from src import config
from src.database.history import HistoryError, HistoryStore
from src.inference.analysis import Status
from src.inference.symptom_screen import SYMPTOMS
from src.plants.catalog import PlantCatalog
from src.plants.conditions import get_condition
from src.service import AnalysisBundle

STATUS_STYLE = {
    Status.LIKELY: ("good", "🌿"),
    Status.UNCERTAIN: ("warn", "🤔"),
    Status.LOW_QUALITY: ("warn", "📷"),
    Status.SPECIES_MISMATCH: ("warn", "🔀"),
    Status.UNFAMILIAR: ("warn", "❓"),
    Status.POSSIBLE_NON_PLANT: ("warn", "🚫"),
    Status.UNSUPPORTED_PLANT: ("info", "📘"),
    Status.MODEL_UNAVAILABLE: ("bad", "⚠️"),
    Status.ANALYSIS_ERROR: ("bad", "⚠️"),
    Status.INVALID_INPUT: ("bad", "⚠️"),
}

DISCLAIMER = (
    "<b>Not a diagnosis.</b> Image-based predictions can be wrong, especially for photos unlike the training "
    "data. Confirm important findings with a local agricultural extension service, plant clinic or plant "
    "pathologist before using any chemical treatment."
)

EXPANDED_SECTIONS = {"actions", "inspect"}
EXPANDED_TITLE_PREFIXES = ("Pests (detected",)


def esc(text) -> str:
    return html.escape(str(text))


def md_bold_to_html(text: str) -> str:
    parts = esc(text).split("**")
    return "".join(f"<b>{p}</b>" if i % 2 else p for i, p in enumerate(parts))


def hero():
    st.markdown(
        """
        <div class="hero">
          <h1>🌱 AI Plant Health Assistant</h1>
          <p>Upload a leaf photo and tell us which plant it is. The assistant checks the photo, compares it with
          a disease classifier trained on 14 crop species, explains how sure it is, and suggests safe next steps.</p>
          <div class="chips">
            <span class="chip">140+ plants with care guides</span>
            <span class="chip">Disease check for 14 crops</span>
            <span class="chip">Symptom check for every plant</span>
            <span class="chip">Pest screening</span>
            <span class="chip">Grad-CAM explanations</span>
            <span class="chip">Uncertainty-aware</span>
            <span class="chip">Runs fully offline</span>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def card(key: str, value: str, sub: str = ""):
    st.markdown(
        f'<div class="card"><div class="k">{esc(key)}</div><div class="v">{esc(value)}</div>'
        f'{f"<div class=s>{esc(sub)}</div>" if sub else ""}</div>',
        unsafe_allow_html=True,
    )


def render_results(bundle: AnalysisBundle, catalog: PlantCatalog):
    result, rec = bundle.result, bundle.recommendation
    style, icon = STATUS_STYLE[result.status]
    st.markdown(
        f'<div class="status {style}"><h3>{icon} {esc(result.status_label)}</h3>'
        f"<p>{md_bold_to_html(rec.summary)}</p></div>",
        unsafe_allow_html=True,
    )
    if result.status == Status.INVALID_INPUT:
        return
    if bundle.report is not None:
        render_overview(bundle.report)

    c1, c2, c3 = st.columns(3)
    with c1:
        card("Plant (your input)", result.plant_name,
             f"Matched: {result.species.display_name}" if result.species else "Not in model's training set")
    with c2:
        if result.shows_candidate and result.condition:
            card("Possible condition", result.condition.name, result.condition.category)
        elif result.symptom_is_primary:
            s = result.symptom
            value = (s.name if s.clear else f"{s.name} + {SYMPTOMS[s.second][0].lower()}" if s.mixed
                     else "No clear pattern")
            card("Symptom pattern", value, "General symptom check - not a specific disease")
        else:
            card("Possible condition", "Not determined", "See explanation above")
    with c3:
        if result.shows_candidate and result.confidence is not None:
            card("Model score", f"{result.confidence:.0%}",
                 "Calibrated softmax score - not the probability the diagnosis is correct")
        elif result.symptom_is_primary:
            s = result.symptom
            score = (f"{s.probability:.0%} / {s.probabilities[s.second]:.0%}" if s.mixed
                     else f"{s.probability:.0%}")
            card("Symptom-check score", score,
                 "Model score - not the probability the pattern is correct")
        else:
            card("Model score", "—", "No reliable model prediction for this case")

    st.write("")
    left, right = st.columns(2)
    with left:
        st.markdown("**Your photo**")
        if result.image is not None:
            st.image(result.image, width="stretch")
    with right:
        st.markdown("**Grad-CAM heatmap**")
        gc = bundle.gradcam
        if gc is not None and gc.ok:
            st.image(gc.overlay, width="stretch")
            st.caption(
                "Warm colours mark regions that most influenced the model's score for "
                f"*{result.condition.name if result.condition else result.predicted_label}*. "
                "A heatmap explains what the model looked at; it does not prove the prediction is right."
            )
        elif gc is not None:
            st.info(gc.error or "The heatmap could not be generated.")
        elif result.symptom_is_primary:
            st.info("No heatmap: Grad-CAM is only available for the 14 crops with a plant-specific disease model.")
        else:
            st.info("No heatmap: Grad-CAM is only shown when the model produced a usable prediction for a "
                    "supported plant, so it is not presented as evidence for an unreliable result.")

    _render_scores(bundle, catalog)

    st.subheader("What to do next")
    for section in rec.sections:
        if not section.items:
            continue
        expanded = section.key in EXPANDED_SECTIONS or section.title.startswith(EXPANDED_TITLE_PREFIXES)
        with st.expander(section.title, expanded=expanded):
            st.markdown("\n".join(f"- {item}" for item in section.items))

    if bundle.history_error:
        st.warning(f"The result could not be saved to history: {bundle.history_error}")
    elif bundle.history_id:
        st.caption("Saved to history.")
    st.markdown(f'<div class="disclaimer">{DISCLAIMER}</div>', unsafe_allow_html=True)


STATE_LABELS = {
    "healthy": "🌿 Healthy", "problem": "⚠️ Problem", "unclear": "❔ Unclear", "detected": "⚠️ Found",
    "not_detected": "✅ Not found", "uncertain": "❔ Uncertain", "not_assessed": "— Not assessed",
}


def render_overview(report):
    """The four assessments (overall health, visible symptoms, pests, disease) side by side."""
    for col, a in zip(st.columns(4), report.assessments):
        with col:
            card(a.title, STATE_LABELS.get(a.state, a.state), a.headline)


def _render_scores(bundle: AnalysisBundle, catalog: PlantCatalog):
    result = bundle.result
    out = result.model_output
    if out is None or result.species is None:
        return
    with st.expander("Model details", expanded=False):
        rows = []
        if result.shows_candidate:
            rows.append((result.predicted_label, result.confidence))
            rows.extend(result.alternatives)
            st.markdown(f"**Scores for {result.species.display_name} classes**")
        else:
            rows = list(out.top_k)
            st.markdown("**What the model would have guessed (not reliable for this image)**")
        for label, p in rows:
            cond = get_condition(label)
            name = cond.name if cond else catalog.condition_display(label)
            species = catalog.species_of(label).display_name
            st.progress(min(max(p, 0.0), 1.0), text=f"{name} ({species}) — {p:.1%}")
        facts = []
        if result.plant_mass is not None:
            facts.append(f"Share of model score on {result.species.display_name} classes: {result.plant_mass:.0%}")
        if out.ood_score is not None:
            facts.append(f"Unfamiliarity score (Mahalanobis): {out.ood_score:.1f}"
                         + (" — above threshold" if result.ood_flag else " — within training range"))
        if out.pest_score is not None:
            method = "CLIP" if out.pest_method == "clip" else "ImageNet"
            facts.append(f"Pest-screen score ({method}): {out.pest_score:.2f}")
        if facts:
            st.caption(" · ".join(facts))


def render_history(store: HistoryStore | None):
    if store is None:
        st.warning("History is unavailable because the local database could not be opened.")
        return
    try:
        records = store.recent(200)
    except HistoryError as exc:
        st.error(str(exc))
        return
    if not records:
        st.info("No saved analyses yet. Results are saved automatically after each analysis.")
        return

    table = pd.DataFrame([{
        "When (UTC)": r.created_at.replace("T", " ")[:16],
        "Plant": r.plant_name,
        "Status": r.status_label,
        "Condition": r.condition_name or "—",
        "Score": f"{r.confidence:.0%}" if r.confidence is not None else "—",
    } for r in records])
    st.dataframe(table, hide_index=True, width="stretch")

    st.markdown("#### Review a saved analysis")
    labels = {r.id: f"#{r.id} · {r.created_at[:16].replace('T', ' ')} · {r.plant_name} · {r.condition_name or r.status_label}"
              for r in records}
    chosen = st.selectbox("Saved analysis", list(labels), format_func=labels.get, label_visibility="collapsed")
    record = next(r for r in records if r.id == chosen)
    with st.container(border=True):
        st.markdown(md_bold_to_html(record.recommendations.get("summary", record.summary)), unsafe_allow_html=True)
        for section in record.recommendations.get("sections", []):
            with st.expander(section["title"]):
                st.markdown("\n".join(f"- {i}" for i in section["items"]))
        c1, c2 = st.columns(2)
        with c1:
            if st.button("🗑️ Delete this entry", key=f"del_{record.id}", width="stretch"):
                try:
                    store.delete(record.id)
                    st.rerun()
                except HistoryError as exc:
                    st.error(str(exc))
        with c2:
            st.download_button("⬇️ Download as JSON", json.dumps(record.recommendations, indent=2),
                               file_name=f"plant_analysis_{record.id}.json", mime="application/json",
                               width="stretch")

    with st.expander("Delete all history"):
        confirm = st.checkbox("I understand this permanently deletes all saved analyses.")
        if st.button("Delete all", disabled=not confirm, type="secondary"):
            try:
                store.clear()
                st.rerun()
            except HistoryError as exc:
                st.error(str(exc))


def render_about(catalog: PlantCatalog):
    st.markdown("### How it works")
    st.markdown(
        "1. **Validation** – file type, size, readability and basic quality (blur, brightness, leaf-coloured area).\n"
        "2. **Plant check** – your plant name is matched against the 14 species the classifier knows. "
        "Other plants get a general symptom check and care guidance.\n"
        "3. **Classification** – a MobileNetV2 fine-tuned on PlantVillage scores 38 classes. Scores are "
        "temperature-calibrated on validation data.\n"
        "4. **Reliability checks** – the result is accepted only if it agrees with your plant, passes a "
        "confidence threshold, and the image is not flagged as unfamiliar (Mahalanobis distance on model features).\n"
        "5. **Recommendations** – conservative, low-risk steps; watering, nutrient and pest advice rely on your "
        "answers, not on the photo alone.\n"
    )
    try:
        with open(config.CALIBRATION_PATH, encoding="utf-8") as f:
            cal = json.load(f)
        test, th = cal["test_report"], cal["thresholds"]
        st.markdown("### Measured performance (PlantVillage test split)")
        c1, c2, c3 = st.columns(3)
        with c1:
            card("Top-1 accuracy", f"{test['accuracy']:.2%}", f"{test['n']:,} held-out test images")
        with c2:
            sel = test["selective"]
            card("Accuracy when 'likely'", f"{sel['accuracy_on_accepted']:.1%}",
                 f"Covers {sel['coverage']:.0%} of test images (threshold {th['confidence_threshold']:.2f})")
        with c3:
            card("Calibration error (ECE)", f"{test['ece_temperature_scaled']:.3f}",
                 f"was {test['ece_uncalibrated']:.3f} before temperature scaling")
        st.caption("These numbers come from lab-style PlantVillage photos. They are not estimates of real-world "
                   "diagnostic accuracy on garden or field photos.")
    except (OSError, KeyError, ValueError, TypeError):
        st.caption("Calibration report not found. Run `python -m src.evaluation.calibrate` to generate it.")

    st.markdown("### Plants with a disease check")
    st.caption("The disease classifier was trained only on these 14 crops. Every other plant in the list gets "
               "pest screening and a care guide for its plant type, but no disease prediction.")
    rows = []
    for info in sorted(catalog.species.values(), key=lambda s: s.display_name):
        conds = [get_condition(l).name if get_condition(l) else catalog.condition_display(l) for l in info.labels]
        rows.append({"Plant": info.display_name, "Classes the model knows": ", ".join(conds),
                     "Coverage note": "⚠️ " + info.coverage_warning.split(".")[0] if info.coverage_warning else ""})
    st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")

    st.markdown("### Known limitations")
    st.markdown(
        "- Trained on single leaves on plain backgrounds; real-world photos are often harder.\n"
        "- The pest screen (zero-shot CLIP) can flag *possible* insects or eggs but cannot identify species; "
        "it flagged 83% of IP102 pest photos and misses tiny mites and scale insects most often.\n"
        "- Plants without a disease model get a general symptom check (spots, mildew, rust, mottling). It "
        "describes the visible pattern, not the disease, and is right about 83% of the time when it reports "
        "one clear pattern (lab photos).\n"
        "- Cannot determine watering needs or nutrient deficiencies from a photo.\n"
        "- The unfamiliar-image check reduces, but does not eliminate, confident wrong answers on unknown plants "
        "or diseases.\n"
    )
