import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { RedditMatch, ScanRequest } from "@/types";

const DATA_DIR =
  process.env.DATA_DIR ||
  "./data";

const USER_AGENT = "ForgeCadNeo-Dashboard/1.0 (marketing automation scanner)";

interface RedditListingChild {
  data: {
    id: string;
    title: string;
    subreddit: string;
    permalink: string;
    author: string;
    score: number;
    num_comments: number;
    selftext: string;
    created_utc: number;
  };
}

interface RedditListing {
  data: {
    children: RedditListingChild[];
  };
}

/**
 * POST /api/reddit/scan
 *
 * Accepts { keywords: string[], subreddits: string[] } and scans Reddit
 * for posts matching those keywords in those subreddits.
 * Returns matches and merges new ones into reddit-matches.json.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScanRequest;
    const { keywords, subreddits } = body;

    if (
      !Array.isArray(keywords) ||
      !Array.isArray(subreddits) ||
      keywords.length === 0 ||
      subreddits.length === 0
    ) {
      return NextResponse.json(
        { error: "keywords and subreddits must be non-empty arrays" },
        { status: 400 }
      );
    }

    // Normalize keywords to lowercase for case-insensitive matching
    const lowerKeywords = keywords.map((k) => k.toLowerCase().trim());
    const now = new Date();
    const nowEpoch = now.getTime() / 1000;

    const allMatches: RedditMatch[] = [];

    // Fetch posts from each subreddit
    for (const subreddit of subreddits) {
      try {
        const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=50`;
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
        });

        if (!response.ok) {
          console.error(
            `Failed to fetch r/${subreddit}: ${response.status} ${response.statusText}`
          );
          continue;
        }

        const listing = (await response.json()) as RedditListing;
        const posts = listing.data?.children ?? [];

        for (const post of posts) {
          const { data: p } = post;
          const titleLower = p.title.toLowerCase();
          const selftextLower = (p.selftext || "").toLowerCase();

          for (const keyword of lowerKeywords) {
            if (titleLower.includes(keyword) || selftextLower.includes(keyword)) {
              const hoursOld = (nowEpoch - p.created_utc) / 3600;

              allMatches.push({
                id: p.id,
                title: p.title,
                subreddit: p.subreddit,
                url: `https://www.reddit.com${p.permalink}`,
                author: p.author,
                score: p.score,
                num_comments: p.num_comments,
                selftext_preview: (p.selftext || "").substring(0, 300),
                matched_keyword: keywords[lowerKeywords.indexOf(keyword)],
                created_utc: p.created_utc,
                hours_old: Math.round(hoursOld * 10) / 10,
                found_at: now.toISOString(),
              });

              // Only match the first keyword per post to avoid duplicates
              break;
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning r/${subreddit}:`, err);
        continue;
      }
    }

    // Deduplicate matches by post ID (keep first occurrence)
    const uniqueMap = new Map<string, RedditMatch>();
    for (const match of allMatches) {
      if (!uniqueMap.has(match.id)) {
        uniqueMap.set(match.id, match);
      }
    }
    const uniqueMatches = Array.from(uniqueMap.values());

    // Merge into existing reddit-matches.json
    const filePath = path.join(DATA_DIR, "reddit-matches.json");
    let existing: RedditMatch[] = [];
    try {
      const content = await fs.readFile(filePath, "utf-8");
      existing = JSON.parse(content);
    } catch {
      existing = [];
    }

    const existingIds = new Set(existing.map((m) => m.id));
    const toAdd = uniqueMatches.filter((m) => !existingIds.has(m.id));
    const merged = [...toAdd, ...existing].slice(0, 500);

    await fs.writeFile(filePath, JSON.stringify(merged, null, 2), "utf-8");

    return NextResponse.json({
      data: {
        matches: uniqueMatches,
        added: toAdd.length,
        total: merged.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to scan Reddit", details: message },
      { status: 500 }
    );
  }
}
