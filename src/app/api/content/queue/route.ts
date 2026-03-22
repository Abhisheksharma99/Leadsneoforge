import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  parseContentQueueMarkdown,
  updateContentPostStatus,
} from "@/lib/parsers";
import type { ContentPostStatus } from "@/types";

const DATA_DIR = process.env.DATA_DIR || "./data";

export async function GET() {
  try {
    const filePath = path.join(DATA_DIR, "content-queue.md");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const posts = parseContentQueueMarkdown(fileContent);

    return NextResponse.json({ data: posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read content queue", details: message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      postNumber: number;
      status: ContentPostStatus;
    };

    const { postNumber, status } = body;

    if (!postNumber || !status) {
      return NextResponse.json(
        { error: "postNumber and status are required" },
        { status: 400 }
      );
    }

    const validStatuses: ContentPostStatus[] = ["pending", "scheduled", "posted"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const filePath = path.join(DATA_DIR, "content-queue.md");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const updated = updateContentPostStatus(fileContent, postNumber, status);
    await fs.writeFile(filePath, updated, "utf-8");

    const posts = parseContentQueueMarkdown(updated);

    return NextResponse.json({ data: posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update content post", details: message },
      { status: 500 }
    );
  }
}
