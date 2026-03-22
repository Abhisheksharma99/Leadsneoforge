import { NextRequest, NextResponse } from "next/server";
import type { LatestRedditPost } from "@/types";

const USER_AGENT = "ForgeCadNeo-Dashboard/1.0 (marketing automation scanner)";

/** Default subreddits if none specified */
const DEFAULT_SUBREDDIT = "cad";

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
 * GET /api/reddit/latest
 *
 * Returns the latest posts from a subreddit regardless of keyword matching.
 * Accepts optional ?subreddit=cad query param.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const subreddit = searchParams.get("subreddit") || DEFAULT_SUBREDDIT;
    const nowEpoch = Date.now() / 1000;

    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=25`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(
        `Reddit API returned ${response.status} ${response.statusText} for r/${subreddit}`
      );
    }

    const listing = (await response.json()) as RedditListing;
    const posts = listing.data?.children ?? [];

    const latestPosts: LatestRedditPost[] = posts.map((post) => {
      const p = post.data;
      const hoursOld = (nowEpoch - p.created_utc) / 3600;

      return {
        id: p.id,
        title: p.title,
        subreddit: p.subreddit,
        url: `https://www.reddit.com${p.permalink}`,
        author: p.author,
        score: p.score,
        num_comments: p.num_comments,
        selftext_preview: (p.selftext || "").substring(0, 300),
        created_utc: p.created_utc,
        hours_old: Math.round(hoursOld * 10) / 10,
      };
    });

    return NextResponse.json({ data: latestPosts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch latest posts", details: message },
      { status: 500 }
    );
  }
}
