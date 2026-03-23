import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  parseContentQueueMarkdown,
  updateContentPostStatus,
} from "@/lib/parsers";
import type { ContentPostStatus } from "@/types";

const DATA_DIR = process.env.DATA_DIR || "./data";

// ─── POST: Create a new content post ────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      title: string;
      platforms: string[];
      scheduled?: string;
      twitter?: string;
      linkedin?: string;
      hashtags?: string;
      status?: ContentPostStatus;
    };

    if (!body.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const filePath = path.join(DATA_DIR, "content-queue.md");

    // Read existing content to determine next post number
    let existingContent = "";
    try {
      existingContent = await fs.readFile(filePath, "utf-8");
    } catch {
      // File doesn't exist yet, start fresh
    }

    const existingPosts = existingContent
      ? parseContentQueueMarkdown(existingContent)
      : [];
    const nextNumber =
      existingPosts.length > 0
        ? Math.max(...existingPosts.map((p) => p.number)) + 1
        : 1;

    // Build markdown for the new post
    const status = body.status || "pending";
    const platforms = body.platforms?.join(",") || "twitter";
    const scheduled =
      body.scheduled || new Date().toISOString().split("T")[0];

    let newPostMd = `\n\n---\n\n## Post ${nextNumber} — ${body.title}\n`;
    newPostMd += `- status: ${status}\n`;
    newPostMd += `- platform: ${platforms}\n`;
    newPostMd += `- scheduled: ${scheduled}\n`;
    if (body.twitter) newPostMd += `- twitter: ${body.twitter}\n`;
    if (body.linkedin) newPostMd += `- linkedin: ${body.linkedin}\n`;
    if (body.hashtags) newPostMd += `- hashtags: ${body.hashtags}\n`;

    // Append to file
    const updatedContent = existingContent.trimEnd() + newPostMd;
    await fs.writeFile(filePath, updatedContent, "utf-8");

    const posts = parseContentQueueMarkdown(updatedContent);
    const created = posts.find((p) => p.number === nextNumber);

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create content post", details: message },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove a content post ──────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postNumber = parseInt(searchParams.get("postNumber") || "", 10);

    if (!postNumber) {
      return NextResponse.json(
        { error: "postNumber query parameter is required" },
        { status: 400 }
      );
    }

    const filePath = path.join(DATA_DIR, "content-queue.md");
    const fileContent = await fs.readFile(filePath, "utf-8");

    // Split by --- separator, remove the matching post section, rejoin
    const sections = fileContent.split(/^---$/m);
    const filtered = sections.filter((section) => {
      const match = section.match(/##\s+Post\s+(\d+)\s*[—–-]/);
      return !match || parseInt(match[1], 10) !== postNumber;
    });

    const updatedContent = filtered.join("---").replace(/\n{3,}/g, "\n\n");
    await fs.writeFile(filePath, updatedContent, "utf-8");

    const posts = parseContentQueueMarkdown(updatedContent);
    return NextResponse.json({ data: posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete content post", details: message },
      { status: 500 }
    );
  }
}

// ─── GET: List all content posts ─────────────────────────────────────────────

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
