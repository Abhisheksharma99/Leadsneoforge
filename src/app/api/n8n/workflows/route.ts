import { NextResponse } from "next/server";
import { listWorkflows } from "@/lib/n8n";

export async function GET() {
  try {
    const result = await listWorkflows();
    return NextResponse.json({ data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch workflows from n8n", details: message },
      { status: 502 }
    );
  }
}
