import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  parseDirectoriesMarkdown,
  updateDirectoryStatus,
} from "@/lib/parsers";
import type { DirectoryStatus } from "@/types";

const DATA_DIR = process.env.DATA_DIR || "./data";

export async function GET() {
  try {
    const filePath = path.join(DATA_DIR, "directories.md");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const directories = parseDirectoriesMarkdown(fileContent);

    return NextResponse.json({ data: directories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read directories", details: message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      entryNumber: number;
      status: DirectoryStatus;
      submittedDate?: string;
    };

    const { entryNumber, status, submittedDate } = body;

    if (!entryNumber || !status) {
      return NextResponse.json(
        { error: "entryNumber and status are required" },
        { status: 400 }
      );
    }

    const validStatuses: DirectoryStatus[] = [
      "pending",
      "submitted",
      "approved",
      "rejected",
      "live",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const filePath = path.join(DATA_DIR, "directories.md");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const updated = updateDirectoryStatus(
      fileContent,
      entryNumber,
      status,
      submittedDate
    );
    await fs.writeFile(filePath, updated, "utf-8");

    const directories = parseDirectoriesMarkdown(updated);

    return NextResponse.json({ data: directories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update directory entry", details: message },
      { status: 500 }
    );
  }
}
