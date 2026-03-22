import { NextRequest, NextResponse } from "next/server";
import { callAI, isAIConfigured } from "@/lib/ai";

const SYSTEM_PROMPT = `You are an expert n8n workflow builder. Given a natural language description of an automation workflow, generate a valid n8n workflow JSON.

IMPORTANT RULES:
1. Use valid n8n node types. Common ones:
   - n8n-nodes-base.manualTrigger (for manual start)
   - n8n-nodes-base.scheduleTrigger (for cron/schedule)
   - n8n-nodes-base.webhook (for webhook triggers)
   - n8n-nodes-base.httpRequest (for API calls)
   - n8n-nodes-base.code (for JavaScript code - use jsCode parameter)
   - n8n-nodes-base.if (for conditionals)
   - n8n-nodes-base.set (for setting values - use assignments.assignments format)
   - n8n-nodes-base.merge (for merging data)
   - n8n-nodes-base.splitInBatches (for batch processing)
   - n8n-nodes-base.wait (for delays)
   - n8n-nodes-base.noOp (for no operation/passthrough)
   - n8n-nodes-base.emailSend (for email)
   - n8n-nodes-base.slack (for Slack messages)
   - n8n-nodes-base.discord (for Discord messages)
   - n8n-nodes-base.telegram (for Telegram messages)
   - n8n-nodes-base.googleSheets (for Google Sheets)
   - n8n-nodes-base.postgres (for PostgreSQL)
   - n8n-nodes-base.mysql (for MySQL)
   - n8n-nodes-base.redis (for Redis)
   - n8n-nodes-base.openAi (for OpenAI API)
   - n8n-nodes-base.rssFeedRead (for RSS feeds)

2. Code nodes MUST use "jsCode" parameter (NOT "functionCode") with typeVersion 2
3. Set nodes MUST use "assignments" format with typeVersion 3.4
4. Position nodes in a left-to-right flow with ~250px horizontal spacing
5. Ensure all connections reference valid node names
6. Always start with a trigger node (manualTrigger, scheduleTrigger, or webhook)
7. Generate a descriptive workflow name

Return ONLY valid JSON with this structure:
{
  "name": "Workflow Name",
  "nodes": [...],
  "connections": {...},
  "settings": { "executionOrder": "v1" }
}

Do NOT include any text before or after the JSON. Only output the JSON object.`;

/**
 * POST /api/workflows/generate
 *
 * Takes a natural language prompt and optionally previous messages
 * to generate an n8n workflow via Groq.
 *
 * Body: { prompt: string, messages?: { role: string; content: string }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, messages: prevMessages } = body as {
      prompt: string;
      messages?: Array<{ role: string; content: string }>;
    };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          error: "Groq API key not configured",
          details: "Add GROQ_API_KEY to your .env.local file",
        },
        { status: 503 }
      );
    }

    // Build the full prompt including conversation history
    let fullPrompt = "";
    if (prevMessages?.length) {
      for (const msg of prevMessages) {
        if (msg.role === "user") {
          fullPrompt += `User: ${msg.content}\n\n`;
        } else if (msg.role === "assistant") {
          fullPrompt += `Assistant: ${msg.content}\n\n`;
        }
      }
    }
    fullPrompt += prompt;

    // Call Groq API
    const result = await callAI({
      system: SYSTEM_PROMPT,
      prompt: fullPrompt,
      temperature: 0.3,
      maxTokens: 4096,
    });

    const rawContent = result.text;

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const usage = { input_tokens: result.inputTokens, output_tokens: result.outputTokens, total_tokens: result.inputTokens + result.outputTokens };

    // Parse and validate the workflow JSON
    let workflow: Record<string, unknown>;
    try {
      workflow = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({
        data: {
          workflow: null,
          raw: rawContent,
          error: "AI generated invalid JSON. Try rephrasing your request.",
          usage,
        },
      });
    }

    // Basic validation
    if (!workflow.nodes || !workflow.connections) {
      return NextResponse.json({
        data: {
          workflow: null,
          raw: rawContent,
          error: "Generated workflow is missing required fields (nodes, connections).",
          usage,
        },
      });
    }

    return NextResponse.json({
      data: {
        workflow,
        raw: null,
        error: null,
        usage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate workflow", details: message },
      { status: 500 }
    );
  }
}
