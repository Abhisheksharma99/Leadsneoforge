/**
 * Groq Cloud API client for all dashboard AI routes.
 * Uses OpenAI-compatible chat completions endpoint.
 * Free tier available at console.groq.com — no credit card required.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export interface AIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Call Groq Cloud API with a system prompt and user message.
 */
export async function callAI(opts: {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<AIResponse> {
  const {
    system,
    prompt,
    model = DEFAULT_MODEL,
    maxTokens = 1024,
    temperature = 0.7,
  } = opts;

  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const completion = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  return {
    text: completion.choices?.[0]?.message?.content?.trim() || "",
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
    model: completion.model || model,
  };
}

/**
 * Check if AI API is configured.
 */
export function isAIConfigured(): boolean {
  return !!GROQ_API_KEY;
}

/**
 * ForgeCadNeo product context for marketing content generation.
 */
export const PRODUCT_CONTEXT = `
PRODUCT: ForgeCadNeo
URL: https://forgecadneo.com
FREE VIEWER: https://forgecadneo.com/viewer (no login required)

WHAT IT DOES:
- Converts 2D engineering drawings into manufacturing-grade 3D STEP files using AI
- Text-to-3D: describe a part in plain English, get a parametric 3D model
- 6 AI models (GPT-5.2, Claude Opus 4.6, Sonnet 4.6, Gemini 3.1 Pro, GPT-4o, Gemini 2.5 Flash) compete
- STEP AP214 export via pythonOCC for sub-micron precision
- Multi-part assembly system with exploded views, BOM, LEGO-style instructions
- Free browser-based STEP/STL viewer with CAD editing (booleans, fillets, chamfers, shell, mirror, scale)
- Parametric sliders for real-time dimension adjustment via OpenSCAD WASM
- Chat-based model refinement with version history

PRICING: Free (3 credits), Pro ($29/mo, 50 credits), Enterprise (custom)

KEY ANGLES:
- Legacy drawing digitization (4-8 hrs manual → minutes with AI)
- Manufacturing-grade output (not approximate meshes)
- No CAD expertise required
`.trim();
