import { NextRequest, NextResponse } from "next/server";
import { getWorkflow } from "@/lib/n8n";

/**
 * GET /api/n8n/workflows/[id]/details
 *
 * Returns full workflow details including nodes, connections,
 * and settings for visualization.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workflow = await getWorkflow(id);

    return NextResponse.json({ data: workflow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch workflow details", details: message },
      { status: 502 }
    );
  }
}
