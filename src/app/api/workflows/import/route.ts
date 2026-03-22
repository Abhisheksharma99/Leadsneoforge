import { NextRequest, NextResponse } from "next/server";

const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

/**
 * POST /api/workflows/import
 *
 * Imports a generated workflow JSON into n8n.
 * Strips fields that n8n rejects and creates the workflow.
 *
 * Body: { workflow: object, activate?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow, activate } = body as {
      workflow: Record<string, unknown>;
      activate?: boolean;
    };

    if (!workflow || !workflow.nodes) {
      return NextResponse.json(
        { error: "workflow with nodes is required" },
        { status: 400 }
      );
    }

    // Strip fields n8n rejects
    const cleanWorkflow = {
      name: workflow.name || "Generated Workflow",
      nodes: workflow.nodes,
      connections: workflow.connections || {},
      settings: workflow.settings || { executionOrder: "v1" },
    };

    // Create workflow in n8n
    const createResponse = await fetch(`${N8N_BASE_URL}/api/v1/workflows`, {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": N8N_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanWorkflow),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      throw new Error(
        `n8n rejected workflow: ${createResponse.status} — ${errText}`
      );
    }

    const created = (await createResponse.json()) as {
      id: string;
      name: string;
      active: boolean;
    };

    // Optionally activate
    if (activate && created.id) {
      try {
        await fetch(
          `${N8N_BASE_URL}/api/v1/workflows/${created.id}/activate`,
          {
            method: "POST",
            headers: { "X-N8N-API-KEY": N8N_API_KEY },
          }
        );
      } catch {
        // Non-critical: workflow was created but activation failed
      }
    }

    return NextResponse.json({
      data: {
        id: created.id,
        name: created.name,
        active: activate ? true : created.active,
        message: `Workflow "${created.name}" created in n8n`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to import workflow to n8n", details: message },
      { status: 500 }
    );
  }
}
