import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { RedditMatch } from "@/types";

const DATA_DIR = process.env.DATA_DIR || "./data";

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(DATA_DIR, "reddit-matches.json");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const matches: RedditMatch[] = JSON.parse(fileContent);

    // Apply optional filters from query params
    const { searchParams } = request.nextUrl;
    const subredditFilter = searchParams.get("subreddit");
    const keywordFilter = searchParams.get("keyword");

    let filtered = matches;

    if (subredditFilter) {
      filtered = filtered.filter(
        (m) => m.subreddit.toLowerCase() === subredditFilter.toLowerCase()
      );
    }

    if (keywordFilter) {
      filtered = filtered.filter(
        (m) => m.matched_keyword.toLowerCase() === keywordFilter.toLowerCase()
      );
    }

    // Sort by most recent first
    filtered.sort((a, b) => b.created_utc - a.created_utc);

    return NextResponse.json({ data: filtered });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read reddit matches", details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reddit/matches
 * Accept new matches from n8n workflow and merge with existing data.
 * Deduplicates by post ID, keeps most recent 500 entries.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { matches: RedditMatch[] };
    const newMatches = body.matches ?? [];

    if (!Array.isArray(newMatches)) {
      return NextResponse.json(
        { error: "matches must be an array" },
        { status: 400 }
      );
    }

    const filePath = path.join(DATA_DIR, "reddit-matches.json");

    // Read existing
    let existing: RedditMatch[] = [];
    try {
      const content = await fs.readFile(filePath, "utf-8");
      existing = JSON.parse(content);
    } catch {
      existing = [];
    }

    // Merge and deduplicate by ID
    const existingIds = new Set(existing.map((m) => m.id));
    const toAdd = newMatches.filter((m) => !existingIds.has(m.id));
    const merged = [...toAdd, ...existing].slice(0, 500);

    await fs.writeFile(filePath, JSON.stringify(merged, null, 2), "utf-8");

    return NextResponse.json({
      data: {
        added: toAdd.length,
        total: merged.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to save reddit matches", details: message },
      { status: 500 }
    );
  }
}
