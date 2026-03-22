import { NextRequest, NextResponse } from "next/server";
import { activateWorkflow, deactivateWorkflow, getWorkflow } from "@/lib/n8n";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { active: boolean };

    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        { error: "'active' boolean field is required" },
        { status: 400 }
      );
    }

    if (body.active) {
      await activateWorkflow(id);
    } else {
      await deactivateWorkflow(id);
    }

    // Fetch updated workflow state
    const workflow = await getWorkflow(id);

    return NextResponse.json({ data: workflow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to toggle workflow", details: message },
      { status: 502 }
    );
  }
}
