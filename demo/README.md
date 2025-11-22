# EO Legacy Demo Stack

This directory contains the legacy Epistemic Observability (EO) demo and its supporting files. The demo illustrates the original EO framework before the lean context and formula engine work was introduced in the main `index.html` experience.

## Contents
- `eo_demo.html` – Standalone demo page that wires together the legacy EO stack.
- `eo_styles.css` – Styling for the legacy demo UI.
- `eo_data_structures.js` – Core EO schemas and utilities for cells, values, contexts, and statistics.
- `eo_context_engine.js` – Handles context inference and propagation for imported and edited records.
- `eo_sup_detector.js` – Implements superposition (SUP) detection and labeling for ambiguous values.
- `eo_stability_classifier.js` – Classifies record stability based on EO heuristics.
- `eo_cell_modal.js` – Renders the modal that displays EO details for individual cells.
- `eo_integration.js` – Glue code that integrates the EO stack with the demo table and UI events.

## Notes
- The files here are self-contained and loaded directly by `eo_demo.html`. They are not required by the primary `index.html`, which uses the newer lean context stack (`formula_engine.js`, `formula_field_service.js`, and `eo_lean_context.js`).
- To try the legacy experience, open `demo/eo_demo.html` in a browser.
