"""
Assignment 7 — DoS/DDoS traffic analysis
========================================

Dataset: CIC-DDoS2019-15C (Hugging Face)
  https://huggingface.co/datasets/RonaldoMPF/CIC-DDoS2019-15C

A preprocessed, feature-selected version of the CIC-DDoS2019 dataset from the
Canadian Institute for Cybersecurity (UNB). 12 classes (BENIGN + 11 DDoS attack
types), 600,000 rows total (50,000 per class), split 480k train / 120k test.

This script:
  1. Loads the official train/test CSVs (download them into Assignment7/data/).
  2. Cleans the data (index column, +/-inf values, NaNs).
  3. Produces normal-vs-attack visualizations (saved to results/).
  4. Trains a RandomForest and a Logistic Regression baseline on the same split.
  5. Reports accuracy, per-class precision/recall/F1, and a confusion matrix.
  6. Writes machine-readable metrics to results/analysis_results.json.

Run:  python dos_ddos_analysis.py        (from the Assignment7/ directory)
No live network traffic is generated or attacked — public dataset only.
"""

import json
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless-friendly
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.preprocessing import StandardScaler

BASE = Path(__file__).resolve().parent
DATA = BASE / "data"
RESULTS = BASE / "results"
RESULTS.mkdir(exist_ok=True)

RANDOM_STATE = 42

# ---------------------------------------------------------------------------
# 1. Load
# ---------------------------------------------------------------------------
print("Loading dataset...")
train_df = pd.read_csv(DATA / "train.csv")
test_df = pd.read_csv(DATA / "test.csv")
print(f"  train: {train_df.shape}  test: {test_df.shape}")

# The CSVs carry a leading unnamed index column and padded column names.
train_df.columns = [c.strip() for c in train_df.columns]
test_df.columns = [c.strip() for c in test_df.columns]
drop_cols = [c for c in train_df.columns if c.lower().startswith("unnamed")]
train_df = train_df.drop(columns=drop_cols, errors="ignore")
test_df = test_df.drop(columns=drop_cols, errors="ignore")

LABEL = "Label"
feature_cols = [c for c in train_df.columns if c != LABEL]
print(f"  features ({len(feature_cols)}): {feature_cols}")

# ---------------------------------------------------------------------------
# 2. Clean  (the raw CIC flows contain +/-inf and NaN values)
# ---------------------------------------------------------------------------
for df in (train_df, test_df):
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    for c in feature_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")

n_train_nan = int(train_df[feature_cols].isna().sum().sum())
n_test_nan = int(test_df[feature_cols].isna().sum().sum())
print(f"  NaNs after inf->NaN: train={n_train_nan} test={n_test_nan}")

# Impute with the training median (never peek at the test set).
medians = train_df[feature_cols].median(numeric_only=True)
train_df.fillna(medians, inplace=True)
test_df.fillna(medians, inplace=True)

X_train = train_df[feature_cols].to_numpy()
X_test = test_df[feature_cols].to_numpy()
y_train = train_df[LABEL].to_numpy()
y_test = test_df[LABEL].to_numpy()

classes = sorted(set(y_train) | set(y_test))
print(f"  classes ({len(classes)}): {classes}")

# ---------------------------------------------------------------------------
# 3. Visualizations — normal vs attack traffic
# ---------------------------------------------------------------------------
print("Making visualizations...")

# (a) Class distribution
counts = pd.Series(y_train).value_counts().sort_index()
fig, ax = plt.subplots(figsize=(11, 5))
colors = ["#4ade80" if c == "BENIGN" else "#c084fc" for c in counts.index]
ax.bar(counts.index, counts.values, color=colors)
ax.set_title("CIC-DDoS2019-15C — flows per class (training split)")
ax.set_ylabel("Number of flows")
ax.tick_params(axis="x", rotation=45)
for i, v in enumerate(counts.values):
    ax.text(i, v + 600, str(v), ha="center", fontsize=8)
fig.tight_layout()
fig.savefig(RESULTS / "class_distribution.png", dpi=130)
plt.close(fig)

# (b) BENIGN vs all-attack label for the comparison plots
train_df["_is_attack"] = np.where(train_df[LABEL] == "BENIGN", "BENIGN", "ATTACK")

plot_feats = [
    "Flow Packets/s",
    "Flow Duration",
    "Packet Length Mean",
    "Flow IAT Mean",
]
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
for ax, feat in zip(axes.flat, plot_feats):
    for grp, colr, lbl in (("BENIGN", "#4ade80", "Normal"),
                           ("ATTACK", "#f472b6", "Attack")):
        # log1p scale: CIC flow rates span many orders of magnitude
        vals = np.log1p(train_df.loc[train_df["_is_attack"] == grp, feat].clip(lower=0))
        vals = vals[np.isfinite(vals)]
        ax.hist(vals, bins=80, alpha=0.55, color=colr, label=lbl, density=True)
    ax.set_title(f"{feat}  (log1p scale)")
    ax.legend()
fig.suptitle("Normal vs attack traffic — feature distributions (training split)", y=1.00)
fig.tight_layout()
fig.savefig(RESULTS / "normal_vs_attack_distributions.png", dpi=130)
plt.close(fig)

# (c) Median per-class comparison for one intuitive feature
med = train_df.groupby(LABEL)["Flow Packets/s"].median().sort_values()
fig, ax = plt.subplots(figsize=(10, 5))
ax.barh(med.index, med.values,
        color=["#4ade80" if c == "BENIGN" else "#c084fc" for c in med.index])
ax.set_title("Median Flow Packets/s per class (training split)")
ax.set_xlabel("Flow Packets/s (median)")
fig.tight_layout()
fig.savefig(RESULTS / "median_flow_packets_per_class.png", dpi=130)
plt.close(fig)

# ---------------------------------------------------------------------------
# 4. Models
# ---------------------------------------------------------------------------
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s = scaler.transform(X_test)

results = {
    "dataset": {
        "name": "CIC-DDoS2019-15C",
        "source": "https://huggingface.co/datasets/RonaldoMPF/CIC-DDoS2019-15C",
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
        "features": len(feature_cols),
        "classes": classes,
    },
    "models": {},
}

def evaluate(name, y_pred):
    acc = accuracy_score(y_test, y_pred)
    macro_p = precision_score(y_test, y_pred, average="macro", zero_division=0)
    macro_r = recall_score(y_test, y_pred, average="macro", zero_division=0)
    macro_f = f1_score(y_test, y_pred, average="macro", zero_division=0)
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    print(f"\n=== {name} ===")
    print(f"  accuracy={acc:.4f} macro P={macro_p:.4f} R={macro_r:.4f} F1={macro_f:.4f}")
    results["models"][name] = {
        "accuracy": round(acc, 4),
        "macro_precision": round(macro_p, 4),
        "macro_recall": round(macro_r, 4),
        "macro_f1": round(macro_f, 4),
        "per_class": {c: {k: round(report[c][k], 4) for k in ("precision", "recall", "f1-score", "support")}
                      for c in classes},
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_labels": classes,
    }
    # Confusion matrix figure (row-normalized for readability)
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)
    fig, ax = plt.subplots(figsize=(9, 8))
    im = ax.imshow(cm_norm, cmap="Purples", vmin=0, vmax=1)
    ax.set_xticks(range(len(classes)), classes, rotation=45, ha="right", fontsize=8)
    ax.set_yticks(range(len(classes)), classes, fontsize=8)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(f"Confusion matrix (row-normalized) — {name}")
    fig.colorbar(im, ax=ax, fraction=0.046)
    for i in range(len(classes)):
        for j in range(len(classes)):
            if cm_norm[i, j] >= 0.01:
                ax.text(j, i, f"{cm_norm[i, j]:.2f}", ha="center", va="center",
                        fontsize=6, color="white" if cm_norm[i, j] > 0.5 else "black")
    fig.tight_layout()
    fig.savefig(RESULTS / f"confusion_matrix_{name.lower().replace(' ', '_')}.png", dpi=130)
    plt.close(fig)

# Logistic Regression baseline (scaled features)
print("\nTraining Logistic Regression...")
t0 = time.time()
lr = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)
lr.fit(X_train_s, y_train)
results["models"]["Logistic Regression"] = {"train_seconds": round(time.time() - t0, 1)}
evaluate("Logistic Regression", lr.predict(X_test_s))
results["models"]["Logistic Regression"]["train_seconds"] = round(time.time() - t0, 1)

# RandomForest (raw features — trees do not need scaling)
print("\nTraining RandomForest (this takes a few minutes)...")
t0 = time.time()
rf = RandomForestClassifier(n_estimators=100, random_state=RANDOM_STATE, n_jobs=-1)
rf.fit(X_train, y_train)
train_secs = round(time.time() - t0, 1)
evaluate("Random Forest", rf.predict(X_test))
results["models"]["Random Forest"]["train_seconds"] = train_secs

# Feature importances
imp = sorted(zip(feature_cols, rf.feature_importances_), key=lambda x: -x[1])
results["random_forest_feature_importances"] = {f: round(float(i), 4) for f, i in imp}
fig, ax = plt.subplots(figsize=(9, 5))
ax.barh([f for f, _ in reversed(imp)], [i for _, i in reversed(imp)], color="#c084fc")
ax.set_title("Random Forest — feature importances")
fig.tight_layout()
fig.savefig(RESULTS / "feature_importances.png", dpi=130)
plt.close(fig)

# ---------------------------------------------------------------------------
# 5. Save metrics
# ---------------------------------------------------------------------------
with open(RESULTS / "analysis_results.json", "w") as fh:
    json.dump(results, fh, indent=2)

print("\nSaved to results/:")
for p in sorted(RESULTS.iterdir()):
    print("  -", p.name)
print("\nDone.")
