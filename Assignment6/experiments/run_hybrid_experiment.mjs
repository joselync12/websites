/* =====================================================================
   Assignment 6 — Hybrid experiment: Random Forest alone vs
   Random Forest + AI explanation (deployed Cloudflare Worker + Gemini).

   Run:  node experiments/run_hybrid_experiment.mjs
   (from inside the Assignment6/ folder; no dependencies, Node 18+)

   WHAT THIS MEASURES
   ------------------
   For 10 held-out test rows, the REAL exported Random Forest produces a
   prediction (class, probability, tree votes, per-feature contributions)
   using the exact same code the website runs (docs/js/analyzer.js). Each
   prediction is then sent to the deployed Worker's explanation endpoint.

   Two conditions are compared:
     A) Random Forest alone  -> a label + numbers (the raw contributions)
     B) Random Forest + AI   -> the SAME label/numbers + a plain-language
                                explanation from Gemini

   The classifier prediction is verified to be UNCHANGED by the explanation
   layer: the prediction is computed locally BEFORE any network call, and
   the Worker's response is asserted to contain only { reply } prose — it
   never returns or alters a verdict.

   WHAT THIS DOES *NOT* MEASURE
   ----------------------------
   These are automated lexical grounding checks over the explanation text.
   They show whether the text is CONSISTENT with the model's real votes and
   contributions. They are NOT a user study and do NOT prove that humans
   understand phishing better. Do not cite them as comprehension results.

   No API keys are used or exposed: the Worker holds the Gemini key
   server-side. This script only calls the public Worker URL.
   ===================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");               // Assignment6/
const repoRoot = path.resolve(root, "..");           // repo root
const midterm = path.join(repoRoot, "Midterm", "Phishing-Website-Detection");

const WORKER_URL = "https://mission-comms-chatbot.joselyn-tech3498.workers.dev";
const N_EXAMPLES = 10;

/* ---------------------------------------------------------------------
   Load the real website code (extractFeatures / runInference /
   buildExplainRequest) exactly the way tests/verify-explanation.mjs does,
   so the experiment exercises the production inference path — not a
   re-implementation.
   --------------------------------------------------------------------- */
const read = (p) => fs.readFileSync(p, "utf8");
const stubDocument = {
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { addEventListener() {}, classList: { add() {} } }; }
};
const factory = new Function(
  "document", "fetch", "location",
  read(path.join(midterm, "docs/js/results-data.js")) + "\n" +
  read(path.join(midterm, "docs/js/analyzer.js")) + "\n" +
  "; return { extractFeatures, runInference, buildExplainRequest, FEATURE_ORDER };"
);
const { runInference, buildExplainRequest, FEATURE_ORDER } =
  factory(stubDocument, globalThis.fetch, { protocol: "http:" });

const rfPayload = JSON.parse(
  read(path.join(midterm, "docs/models/random_forest.json"))
);
const fixtures = JSON.parse(
  read(path.join(midterm, "tests/fixtures/inference_cases.json"))
);

/* ---------------------------------------------------------------------
   Deterministic example selection: every 4th of the 40 held-out rows.
   Fixed and documented so the run is reproducible.
   --------------------------------------------------------------------- */
const SELECTED = [];
for (let i = 0; i < fixtures.cases.length && SELECTED.length < N_EXAMPLES; i += 4) {
  SELECTED.push({ index: i, c: fixtures.cases[i] });
}

/* ---------------------------------------------------------------------
   Grounding checks (automated, lexical, documented).
   Fixed keyword lexicons — no model calls, fully reproducible.
   --------------------------------------------------------------------- */
const PHISHING_WORDS = ["phishing", "suspicious", "risky", "risk", "danger",
  "dangerous", "threat", "malicious", "not safe", "red flag", "warning",
  "deceptive", "impersonat", "credential", "steal"];
const LEGIT_WORDS = ["legitimate", "safe", "normal", "harmless",
  "trustworthy", "not phishing", "low risk", "looks fine", "benign", "ordinary"];

// Plain-language words a grounded explanation would use for each feature.
const FEATURE_WORDS = {
  url_length: ["length", "long", "short", "characters", "size"],
  n_dots: ["dot", "subdomain", "period"],
  n_hypens: ["hyphen", "dash"],
  n_underline: ["underscore"],
  n_slash: ["slash", "path", "/"],
  n_questionmark: ["question mark", "query", "?"],
  n_equal: ["equal sign", "=", "parameter"],
  n_at: ["at sign", "@", "host confusion"],
  n_and: ["ampersand", "&", "parameter"],
  n_exclamation: ["exclamation", "!"],
  n_space: ["space", "space character"],
  n_tilde: ["tilde", "~"],
  n_comma: ["comma", ","],
  n_plus: ["plus sign", "plus", "+"],
  n_asterisk: ["asterisk", "*"],
  n_hastag: ["hash", "#", "fragment"],
  n_dollar: ["dollar", "$"],
  n_percent: ["percent", "percent-encoded", "encoded", "%"],
  n_redirection: ["redirect", "redirection", "://", "embedded url", "nested url"]
};

const lc = (s) => String(s).toLowerCase();
const mentions = (text, words) => words.some((w) => text.includes(w));

/* ---------------------------------------------------------------------
   Run one example: local real-model prediction -> Worker explanation.
   --------------------------------------------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let betweenDelayMs = 0;   // set by main() to be polite to the Worker
async function runOne({ index, c }) {
  const values = {};
  FEATURE_ORDER.forEach((f, i) => { values[f] = c.features[i]; });

  // The dataset never published raw URLs, so the URL field is an honest
  // labeled placeholder. The FEATURES are the real held-out row's values.
  const extracted = {
    url: `held-out-row-${index} (raw URL not published in the dataset)`,
    values,
    ordered: c.features
  };
  const outcome = runInference(rfPayload, c.features);
  const model = { label: "Random Forest", accuracy: "82.58%" };

  const record = {
    test_row: index,
    features: c.features,
    expected_from_python: {
      predicted_class: c.expected.random_forest,
      phishing_probability: c.expected.random_forest_proba_phishing
    },
    actual_js: {
      predicted_class: outcome.predictedClass,
      label: outcome.label,
      phishing_probability: outcome.phishingProb,
      votes: outcome.votes,
      n_trees: outcome.nTrees,
      top_contributions: outcome.contributions.slice(0, 5)
    },
    condition_a_random_forest_alone: {
      prediction_shown_to_user: outcome.label,
      probability_shown_to_user: outcome.phishingProb,
      explanation_available: false,
      explanation_source: "none — raw numeric contributions only"
    },
    explanation_request: null,
    condition_b_random_forest_plus_ai: null
  };

  // Cross-check the JS inference against Python's recorded answer for this
  // held-out row. This proves the payload sent to Gemini is real model output.
  record.js_matches_python =
    outcome.predictedClass === c.expected.random_forest &&
    Math.abs(outcome.phishingProb - c.expected.random_forest_proba_phishing) < 1e-6;

  const body = buildExplainRequest({ outcome, model, extracted });
  record.explanation_request = {
    label_sent: body.prediction.label,
    probability_sent: body.prediction.probability,
    contributions_sent: body.prediction.contributions.length,
    votes_sent: body.prediction.votes
  };

  const started = Date.now();
  // Per-request cap so a slow Gemini call fails fast and is recorded as a
  // failure instead of hanging the whole run. The Worker itself tries
  // several Gemini models with retries, so this is generous.
  const REQUEST_TIMEOUT_MS = 90000;
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const ms = Date.now() - started;
    let data = null;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok || !data || typeof data.reply !== "string" || !data.reply.trim()) {
      record.condition_b_random_forest_plus_ai = {
        explanation_available: false,
        http_status: res.status,
        error: (data && (data.error || data.detail)) || "empty or non-JSON reply",
        latency_ms: ms
      };
      return record;
    }

    const reply = data.reply;
    const text = lc(reply);

    // --- grounding checks -------------------------------------------
    const top3 = outcome.contributions.slice(0, 3).map((x) => x.feature);
    const mentionedFeatures = top3.filter((f) =>
      mentions(text, (FEATURE_WORDS[f] || []).concat([lc(f)])));
    const verdictWords = outcome.label === "Phishing" ? PHISHING_WORDS : LEGIT_WORDS;
    const contradicts = outcome.label === "Phishing"
      ? mentions(text, ["is safe", "completely safe", "no risk"])
      : mentions(text, ["is phishing", "is dangerous", "is malicious"]);

    // Did the classifier's verdict change? It cannot: the Worker returns
    // prose only. Assert the response carries no prediction field.
    const responseAlteredVerdict = "label" in data || "prediction" in data ||
      "probability" in data || "isPhishing" in data;

    record.condition_b_random_forest_plus_ai = {
      explanation_available: true,
      http_status: res.status,
      latency_ms: ms,
      explanation_text: reply,
      classifier_prediction_unchanged: !responseAlteredVerdict,
      grounding: {
        mentions_a_top_contributing_feature: mentionedFeatures.length > 0,
        top_features_actually_named: mentionedFeatures,
        top_features_from_model: top3,
        verdict_language_agrees_with_model: mentions(text, verdictWords) && !contradicts,
        claims_to_have_visited_url: mentions(text,
          ["i visited", "i opened", "i loaded", "i fetched", "i browsed"]),
        states_it_is_not_proof_of_safety: mentions(text,
          ["not proof", "can be wrong", "not proof that"])
      }
    };
    return record;
  } catch (err) {
    record.condition_b_random_forest_plus_ai = {
      explanation_available: false,
      error: String(err && err.message ? err.message : err),
      latency_ms: Date.now() - started
    };
    return record;
  }
}

/* ---------------------------------------------------------------------
   Main
   --------------------------------------------------------------------- */
console.log("Assignment 6 — Hybrid experiment");
console.log("Worker:", WORKER_URL);
console.log("Examples:", SELECTED.length, "(deterministic: every 4th held-out row)\n");

betweenDelayMs = 1500;   // small polite pause between Worker calls

const examples = [];
for (const s of SELECTED) {
  const rec = await runOne(s);
  examples.push(rec);
  if (betweenDelayMs) await sleep(betweenDelayMs);
  const b = rec.condition_b_random_forest_plus_ai;
  const g = b.grounding;
  console.log(
    `row ${String(rec.test_row).padStart(2)}  ` +
    `${rec.actual_js.label.padEnd(10)} ` +
    `p=${rec.actual_js.phishing_probability.toFixed(3)}  ` +
    `js==py:${rec.js_matches_python ? "Y" : "N"}  ` +
    `explain:${b.explanation_available ? "Y" : "N"}  ` +
    `ms=${b.latency_ms ?? "-"}  ` +
    (g ? `grounded=${g.mentions_a_top_contributing_feature ? "Y" : "N"} agree=${g.verdict_language_agrees_with_model ? "Y" : "N"} visited=${g.claims_to_have_visited_url ? "Y" : "N"}` : `ERR ${b.error || ""}`)
  );
}

/* --------------------------- aggregates ---------------------------- */
const ok = examples.filter((e) => e.condition_b_random_forest_plus_ai.explanation_available);
const lat = ok.map((e) => e.condition_b_random_forest_plus_ai.latency_ms).sort((a, b2) => a - b2);
const gs = ok.map((e) => e.condition_b_random_forest_plus_ai.grounding);
const mean = (arr) => arr.length ? arr.reduce((a, b2) => a + b2, 0) / arr.length : null;

const aggregate = {
  examples_total: examples.length,
  js_matches_python_count: examples.filter((e) => e.js_matches_python).length,
  explanations_returned: ok.length,
  failures: examples.length - ok.length,
  failure_reasons: examples
    .filter((e) => !e.condition_b_random_forest_plus_ai.explanation_available)
    .map((e) => ({ test_row: e.test_row, error: e.condition_b_random_forest_plus_ai.error })),
  latency_ms: lat.length ? {
    mean: Math.round(mean(lat)),
    median: lat[Math.floor(lat.length / 2)],
    min: lat[0],
    max: lat[lat.length - 1]
  } : null,
  classifier_prediction_unchanged_count:
    ok.filter((e) => e.condition_b_random_forest_plus_ai.classifier_prediction_unchanged).length,
  grounding: gs.length ? {
    mentions_a_top_contributing_feature: gs.filter((g) => g.mentions_a_top_contributing_feature).length,
    verdict_language_agrees_with_model: gs.filter((g) => g.verdict_language_agrees_with_model).length,
    claims_to_have_visited_url: gs.filter((g) => g.claims_to_have_visited_url).length,
    states_it_is_not_proof_of_safety: gs.filter((g) => g.states_it_is_not_proof_of_safety).length,
    of: gs.length
  } : null
};

const out = {
  experiment: "random_forest_alone_vs_random_forest_plus_ai_explanation",
  generated_utc: new Date().toISOString(),
  worker_url: WORKER_URL,
  worker_name: "mission-comms-chatbot",
  model: "Random Forest (exported from the Midterm pipeline; 100 trees)",
  model_source: "Midterm/Phishing-Website-Detection/docs/models/random_forest.json",
  inference_code_source: "Midterm/Phishing-Website-Detection/docs/js/analyzer.js (production path)",
  examples_selection: "deterministic: every 4th of the 40 held-out fixture rows (indices 0,4,...,36)",
  examples_total: SELECTED.length,
  api_keys_used: "none — the Worker holds the Gemini key server-side",
  measurement_caveat:
    "Grounding checks are automated lexical comparisons between the explanation " +
    "text and the model's real votes/contributions. They are NOT a user study and " +
    "do NOT demonstrate improved human comprehension.",
  aggregate,
  examples
};

const outPath = path.join(root, "results", "hybrid_experiment_results.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

console.log("\n=== Aggregate ===");
console.log(JSON.stringify(aggregate, null, 2));
console.log("\nSaved:", path.relative(repoRoot, outPath));
