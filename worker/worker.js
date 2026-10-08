/* ============================================
   Cloudflare Worker — Gemini proxy for the
   Mission Comms chatbot.

   Deploy with:  wrangler deploy
   Set secret:   wrangler secret put GEMINI_API_KEY

   No secrets are stored in this file.
   ============================================ */

const ALLOWED_ORIGIN = "https://joselync12.github.io"; // change me
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"];

const SYSTEM_PROMPT =
  "You are the assistant on Joselyn Carvajal's personal website ('Mission Comms'). " +
  "Joselyn is a senior at Kean University studying Information Technology, interested in " +
  "programming, UX/UI design, cybersecurity, and game design. She enjoys drawing, painting, " +
  "and gaming, and she is building a budget tracker app. Answer visitor questions in a " +
  "friendly, concise, helpful way, in 2-4 sentences. If asked something unrelated, gently " +
  "steer the conversation back to Joselyn, her work, or technology topics.";

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === ALLOWED_ORIGIN || origin === "null") return true;
  // Local testing (Live Server, python -m http.server, etc.)
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const message = typeof body.message === "string" ? body.message.slice(0, 2000) : "";
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content).slice(0, 2000) }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
    });

    // Try each model, retrying on transient errors (503/429)
    let lastError = null;
    for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let geminiResp;
        try {
          const started = Date.now();
          geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
              signal: AbortSignal.timeout(8000),
            }
          );
          console.log(`model=${model} attempt=${attempt} status=${geminiResp.status} ms=${Date.now() - started}`);
        } catch (err) {
          console.log(`model=${model} attempt=${attempt} error=${err && (err.name || err.message)}`);
          lastError = { status: 502, detail: "Failed to reach Gemini" };
          break; // network error — move to next model
        }

        if (geminiResp.ok) {
          const data = await geminiResp.json();
          const reply =
            data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
            "Sorry, I couldn't come up with a response. Try asking again!";
          return new Response(JSON.stringify({ reply }), {
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          });
        }

        const errText = await geminiResp.text();
        lastError = { status: geminiResp.status, detail: errText.slice(0, 500) };

        // 503/429 = transient overload → retry same model
        if (geminiResp.status === 503 || geminiResp.status === 429) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        break; // other errors — move to next model
      }
    }

    return new Response(
      JSON.stringify({ error: "Gemini error", detail: lastError?.detail || "All models unavailable" }),
      {
        status: lastError?.status || 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  },
};
