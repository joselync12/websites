# Assignment 7 — Detecting DoS/DDoS Attacks to Protect Website Availability

## Research Question

> Can abnormal network-flow features (packet rate, flow duration, packet-length
> statistics) reliably separate benign traffic from DoS/DDoS attack traffic on a
> public intrusion-detection dataset?

## What lives here

| File | Purpose |
|---|---|
| `dos_ddos_analysis.py` | Loads the dataset, makes normal-vs-attack charts, trains Logistic Regression + Random Forest, writes metrics and confusion matrices |
| `requirements.txt` | Python libraries the script needs |
| `data/train.csv`, `data/test.csv` | CIC-DDoS2019-15C splits, downloaded from Hugging Face (not committed to git — see `.gitignore`) |
| `results/analysis_results.json` | Machine-readable accuracy, per-class precision/recall/F1, confusion matrices, feature importances |
| `results/*.png` | Charts and confusion matrices referenced by the research page |

## Dataset

**CIC-DDoS2019-15C** on Hugging Face —
https://huggingface.co/datasets/RonaldoMPF/CIC-DDoS2019-15C

A feature-selected version of the **CIC-DDoS2019** dataset from the Canadian
Institute for Cybersecurity (UNB), described in *Distributed Denial of Service
Detection: Enhancing Machine Learning Models for Multiclass Classification*
(https://doi.org/10.1049/ntw2.70014).

- 600,000 flow records total — 480,000 train / 120,000 test (official split)
- 15 columns: 14 selected flow features + `Label`
- 12 classes, balanced at 50,000 samples each: `BENIGN` plus 11 DDoS attack
  types (`DrDoS_DNS`, `DrDoS_LDAP`, `DrDoS_MSSQL`, `DrDoS_NetBIOS`,
  `DrDoS_NTP`, `DrDoS_SNMP`, `DrDoS_SSDP`, `Syn`, `TFTP`, `DrDoS_UDP`,
  `UDP-lag`)

### Download the data

```bash
cd Assignment7/data
curl -L -o train.csv "https://huggingface.co/datasets/RonaldoMPF/CIC-DDoS2019-15C/resolve/main/train.csv"
curl -L -o test.csv  "https://huggingface.co/datasets/RonaldoMPF/CIC-DDoS2019-15C/resolve/main/test.csv"
```

(Or download the two files from the Hugging Face page in a browser.)

## How to run

### Option A — Google Colab

1. Create a new Colab notebook.
2. Download the two CSVs from the link above and upload them, or fetch them in a
   cell with `wget` using the URLs above (save as `train.csv` / `test.csv`).
3. Copy the contents of `dos_ddos_analysis.py` into code cells (it is one
   dependency-light script; change `DATA = Path(...)` to point at where you
   saved the CSVs).
4. Run all cells. The charts and `analysis_results.json` download from the
   Colab sidebar when finished.

### Option B — Local (this repository)

```bash
cd Assignment7
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python dos_ddos_analysis.py
```

(You can also reuse the existing environment: `../Assignment6/.venv/bin/python
dos_ddos_analysis.py` from the repository root.)

Runtime is a few minutes on a laptop — most of it is the Random Forest fitting
480k training rows.

## What the script does

1. **Loads** the official train/test CSVs and normalizes the padded column
   names / drops the leftover index column.
2. **Cleans** — replaces any `+/-inf` values that CICFlowMeter produces with
   NaN, then imputes with the *training* median (test-set medians are never
   used, to avoid leakage). Measured note: this preprocessed 15C version
   contained zero inf/NaN values, so no imputation was actually needed — the
   guard is there so the script also runs safely on the raw CIC files.
3. **Visualizes** — per-class flow counts, BENIGN-vs-ATTACK distributions of
   flow rate, duration, packet length, and inter-arrival time (log1p scale),
   and per-class median flow rate.
4. **Trains** a Logistic Regression baseline (on standardized features) and a
   100-tree Random Forest (on raw features) using the official split — no
   re-shuffling, so results are directly comparable to the dataset's paper.
5. **Evaluates** — accuracy, macro and per-class precision/recall/F1, and
   row-normalized confusion matrices; writes everything to
   `results/analysis_results.json` and PNGs to `results/`.

## Honesty rules followed by this project

- Every number and chart on the research page comes from actually running this
  script on the real downloaded CSVs; the run date is stated on the page.
- No DoS/DDoS attack was generated or simulated — this is offline analysis of a
  public dataset only.
- The dataset and paper are credited to their original creators (UNB CIC and the
  paper's authors); this script is my own pipeline.
- Limitations (lab-generated attacks, class balance unlike the real world,
  single-machine training) are stated on the research page.
