import { NextRequest, NextResponse } from "next/server";

const USER_AGENT = "ForgeCadNeo-Dashboard/1.0 (marketing automation platform)";

/**
 * POST /api/reddit/post
 *
 * Submits a post to Reddit. Requires Reddit OAuth credentials in env vars:
 *   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
 *
 * If credentials are not configured, returns a pre-filled Reddit submit URL
 * so the user can post manually.
 *
 * Body: { subreddit: string, title: string, text?: string, url?: string, flair_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subreddit, title, text, url: linkUrl, flair_id } = body as {
      subreddit: string;
      title: string;
      text?: string;
      url?: string;
      flair_id?: string;
    };

    if (!subreddit || !title) {
      return NextResponse.json(
        { error: "subreddit and title are required" },
        { status: 400 }
      );
    }

    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const username = process.env.REDDIT_USERNAME;
    const password = process.env.REDDIT_PASSWORD;

    // Check if OAuth credentials are configured
    if (!clientId || !clientSecret || !username || !password) {
      // Build a pre-filled Reddit submit URL as fallback
      const params = new URLSearchParams();
      params.set("title", title);
      if (text) params.set("text", text);
      if (linkUrl) params.set("url", linkUrl);

      const submitType = linkUrl ? "link" : "self";
      const submitUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/submit?type=${submitType}&${params.toString()}`;

      return NextResponse.json({
        data: {
          posted: false,
          method: "manual",
          submitUrl,
          message:
            "Reddit API credentials not configured. Use the provided URL to post manually.",
        },
      });
    }

    // Step 1: Get OAuth access token via password grant
    const tokenResponse = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({
          grant_type: "password",
          username,
          password,
        }).toString(),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Failed to get Reddit OAuth token: ${errText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      token_type: string;
      error?: string;
    };

    if (tokenData.error) {
      throw new Error(`Reddit OAuth error: ${tokenData.error}`);
    }

    // Step 2: Submit the post
    const submitParams = new URLSearchParams({
      sr: subreddit,
      title,
      kind: linkUrl ? "link" : "self",
      api_type: "json",
    });

    if (linkUrl) {
      submitParams.set("url", linkUrl);
    } else if (text) {
      submitParams.set("text", text);
    }

    if (flair_id) {
      submitParams.set("flair_id", flair_id);
    }

    const submitResponse = await fetch(
      "https://oauth.reddit.com/api/submit",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": USER_AGENT,
        },
        body: submitParams.toString(),
      }
    );

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      throw new Error(`Reddit submit failed: ${errText}`);
    }

    const submitData = (await submitResponse.json()) as {
      json: {
        errors: string[][];
        data?: { url: string; id: string; name: string };
      };
    };

    if (submitData.json.errors?.length > 0) {
      const errorMessages = submitData.json.errors
        .map((e) => e.join(": "))
        .join(", ");
      throw new Error(`Reddit submission error: ${errorMessages}`);
    }

    return NextResponse.json({
      data: {
        posted: true,
        method: "api",
        postUrl: submitData.json.data?.url,
        postId: submitData.json.data?.id,
        message: `Successfully posted to r/${subreddit}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to post to Reddit", details: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reddit/post
 *
 * Returns the Reddit posting configuration status (are credentials configured?).
 */
export async function GET() {
  const configured = Boolean(
    process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_USERNAME &&
      process.env.REDDIT_PASSWORD
  );

  return NextResponse.json({
    data: {
      configured,
      username: configured ? process.env.REDDIT_USERNAME : null,
      message: configured
        ? "Reddit API credentials configured. Posts will be submitted directly."
        : "Reddit API credentials not configured. Posts will open Reddit's submit page.",
    },
  });
}
