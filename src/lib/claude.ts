/**
 * Claude API client for dashboard API routes.
 * Uses Anthropic's Messages API directly via fetch (no SDK dependency).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export interface ClaudeResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * Call Claude API with a system prompt and user message.
 */
export async function callClaude(opts: {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ClaudeResponse> {
  const {
    system,
    prompt,
    model = DEFAULT_MODEL,
    maxTokens = 1024,
    temperature = 0.7,
  } = opts;

  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const completion = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
    model: string;
  };

  return {
    text: completion.content?.[0]?.text?.trim() || "",
    inputTokens: completion.usage?.input_tokens || 0,
    outputTokens: completion.usage?.output_tokens || 0,
    model: completion.model || model,
  };
}

/**
 * Check if Claude API is configured.
 */
export function isClaudeConfigured(): boolean {
  return !!ANTHROPIC_API_KEY;
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
