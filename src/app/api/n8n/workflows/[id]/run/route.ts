import { NextRequest, NextResponse } from "next/server";

const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://localhost:5678";

/**
 * Map workflow IDs to their webhook trigger paths.
 * This allows us to trigger workflows via webhooks instead of
 * the n8n execution API, which is more reliable for workflows
 * with webhook trigger nodes.
 */
const WEBHOOK_MAP: Record<string, string> = {
  "1IQJ8e2cpxmnGv1T": "reddit-monitor-trigger",
  "t12sNckSAlBZFeoK": "social-scheduler-trigger",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse optional body to pass through to the webhook
    let body: Record<string, unknown> | undefined;
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // No body or invalid JSON — that's fine
    }

    const webhookPath = WEBHOOK_MAP[id];
    if (!webhookPath) {
      return NextResponse.json(
        { error: `No webhook mapping found for workflow ID: ${id}` },
        { status: 404 }
      );
    }

    const webhookUrl = `${N8N_BASE_URL}/webhook/${webhookPath}`;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Webhook responded with ${response.status}: ${errorText}`
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      result = { message: "Workflow triggered successfully" };
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to run workflow", details: message },
      { status: 502 }
    );
  }
}
