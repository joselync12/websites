# Assignment 6 — Hybrid AI-Powered Phishing Detection and Explanation System

## Research Question

> Can adding a grounded AI explanation to the Random Forest phishing detector make
> its predictions easier to interpret while keeping the classifier's predictions
> unchanged?

The improvement is deliberately about **interpretability**, not higher classification
accuracy. The Random Forest stays the sole decision-maker; the AI only explains the
model's own numbers.

## What lives here

| File | Purpose |
|---|---|
| `Hybrid_Phishing_Experiments.ipynb` | Experiment 1 — trains, evaluates, and compares the phishing detection models |
| `experiments/run_hybrid_experiment.mjs` | Experiment 2 — Random Forest alone vs Random Forest + AI explanation, against the deployed Worker |
| `requirements.txt` | Python libraries the notebook needs |
| `results/experiments_results.json` | Machine-readable classifier-comparison results written by the notebook |
| `results/model_accuracy_comparison.png` | Accuracy chart written by the notebook |
| `results/hybrid_experiment_results.json` | Machine-readable hybrid-explanation results written by the Node script |

The notebook **reuses** (does not copy) the Midterm project's assets:

- Dataset: `../Midterm/Phishing-Website-Detection/data/web-page-phishing.csv`
  (Web Page Phishing Dataset by **Daniel Fernandon** on Kaggle —
  https://www.kaggle.com/datasets/danielfernandon/web-page-phishing-dataset)
- Baseline pipeline to replicate: `../Midterm/Phishing-Website-Detection/Phishing_Website_Analysis.ipynb`
- Research reference notebook: "Advanced URL Analysis for Phishing Detection" by
  **mrudhuhas** on Kaggle —
  https://www.kaggle.com/code/mrudhuhas/advanced-url-analysis-for-phishing-detection/notebook

Experiment 2 additionally reuses the **real exported Random Forest**
(`../Midterm/Phishing-Website-Detection/docs/models/random_forest.json`) and the
**production inference code** (`../Midterm/Phishing-Website-Detection/docs/js/analyzer.js`)
so it exercises the exact model the website runs — not a re-implementation.

## How to run Experiment 1 (classifier comparison)

### Option A — Google Colab (same workflow as the Midterm)

1. Upload `web-page-phishing.csv` to Colab (download it from the Kaggle link above),
   **or** clone the repo so `Midterm/Phishing-Website-Detection/data/` is visible.
2. Upload and open `Hybrid_Phishing_Experiments.ipynb`.
3. Run all cells top to bottom. The notebook installs any missing packages itself.

### Option B — Local (this repository)

```bash
cd Assignment6
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install jupyter          # only needed to open the notebook in a browser
jupyter notebook Hybrid_Phishing_Experiments.ipynb
```

A ready-made virtual environment already exists at `Assignment6/.venv/` in this
repository clone (it is not committed to git).

## How to run Experiment 2 (Random Forest alone vs + AI explanation)

A dependency-free Node script (Node 18+). It queries the **deployed**
`mission-comms-chatbot` Cloudflare Worker, so it needs network access but no API
key — the Worker holds the Gemini key server-side.

```bash
cd Assignment6
node experiments/run_hybrid_experiment.mjs
```

It loads the real exported Random Forest and the production `analyzer.js` inference
path, runs 10 held-out test rows (a deterministic selection: every 4th of the 40
fixture rows), cross-checks each JavaScript prediction against the scikit-learn
answer recorded for that row, sends each prediction to the Worker for a
plain-language explanation, and records grounding, response time, and failures to
`results/hybrid_experiment_results.json`.

Because it calls a live service, response times and the exact failure count can
vary between runs; the classifier's predictions will not.

## What the experiments do

**Experiment 1 (notebook):**

1. **Load & clean** the Web Page Phishing Dataset (100,077 rows → 21,891 after
   removing exact duplicates), verifying the same counts as the Midterm project.
2. **Replicate the Midterm baseline** — Decision Tree (81.41%) and Random Forest
   (82.58%) reference accuracies are checked against this run's actual output
   (both reproduced exactly, delta 0.0).
3. **Train four additional models** on the same group-based split — Logistic
   Regression, Gradient Boosting, k-Nearest Neighbors, and SVM.
4. **Compare** all six models with accuracy, precision, recall, F1, training and
   prediction time, plus a 5-fold cross-validation check for stability.

**Experiment 2 (Node script):** see "How to run Experiment 2" above.

## Measured results (from the runs in this repo)

Experiment 1 — single-split accuracy: Random Forest 82.58% > k-NN 82.37% >
Gradient Boosting 82.14% > Decision Tree 81.41% > SVM 81.39% > Logistic Regression
78.41% > Dummy 73.83%. Five-fold CV means: Random Forest 0.8147 ± 0.0034 (most
stable), Gradient Boosting 0.8142, SVM 0.8071, Decision Tree 0.8022, k-NN 0.7909,
Logistic Regression 0.7774.

Experiment 2 — across the 10 held-out examples (run 2026-10-22 against the deployed
Worker): the JavaScript inference matched scikit-learn on **10/10** rows; the
classifier's prediction was **identical with and without** the explanation layer
(verified — the Worker returns only prose, never a verdict); explanations were
returned for **6/10** examples (**4 real HTTP 502 Gemini failures**); mean response
time **12.1 s** (median 12.6 s, max 17.9 s). Of the 6 returned explanations, manual
reading confirmed **6/6** named a real top-3 contributing feature, **6/6** used
verdict language agreeing with the model, **6/6** carried the required "not proof of
safety" caveat, and **0/6** claimed to have visited the URL. The automated lexical
checker undercounts these last three because of phrasing variance (see Limitations
on the research page).

## Honesty rules followed by this project

- Every number above is computed by actually running the notebook or the Node
  script. Nothing is copied from a previous report as if it were a new result.
- Midterm reference accuracies appear only as clearly labeled verification targets.
- Real failures (the 4 Gemini 502 errors) are reported as measured, not hidden.
- The grounding checks are automated lexical comparisons, **not** a user study; no
  claim of improved human comprehension is made from them.
- No API keys are used or exposed — the Worker holds the Gemini key server-side.
