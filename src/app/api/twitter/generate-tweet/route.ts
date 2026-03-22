import { NextRequest, NextResponse } from "next/server";

import { callAI, isAIConfigured } from "@/lib/ai";

interface GenerateTweetRequest {
  topic: string;
  tone?: "witty" | "professional" | "provocative" | "educational";
  isThread?: boolean;
  threadLength?: number;
  hashtags?: string[];
  productName?: string;
  productDescription?: string;
}

const SYSTEM_PROMPT = `You are an expert Twitter/X content creator. Create tweets that:

1. **Hook immediately** — the first 5 words determine if people read
2. **Be concise** — every word must earn its place. 280 chars max per tweet
3. **Drive engagement** — questions, hot takes, and "save this" content perform best
4. **Use formatting** — line breaks, numbered lists, and emojis for readability

SINGLE TWEET RULES:
- Max 280 characters including spaces and hashtags
- Front-load the value — don't bury the lead
- End with a hook: question, CTA, or cliffhanger

THREAD RULES:
- Tweet 1: Hook + promise of value (this determines if people read the rest)
- Middle tweets: One clear point per tweet, numbered
- Last tweet: Summary + CTA (follow, retweet, reply)
- Each tweet must stand alone AND flow as a series
- Keep each tweet under 280 chars
- Separate tweets with ---

TONE GUIDE:
- witty: Clever observations, wordplay, relatable humor
- professional: Data-driven, industry insights, thought leadership
- provocative: Hot takes, contrarian views, conversation starters
- educational: Step-by-step, tips, frameworks, "how to" format`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateTweetRequest;
    const {
      topic,
      tone = "professional",
      isThread = false,
      threadLength = 5,
      hashtags = [],
      productName,
      productDescription,
    } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    if (!isAIConfigured()) {
      const fallback = generateTemplateTweet({ topic, isThread, threadLength, hashtags, productName });
      const parts = isThread ? fallback.split("---").map(s => s.trim()) : [fallback];
      return NextResponse.json({
        data: {
          content: fallback,
          isThread,
          threadParts: parts,
          hashtags,
          characterCount: isThread ? parts[0].length : fallback.length,
          method: "template",
          message: "Generated using templates (add GROQ_API_KEY for AI-powered tweets)",
        },
      });
    }

    const hashtagStr = hashtags.length > 0 ? `\nInclude these hashtags: ${hashtags.join(" ")}` : "";
    const productContext = productName
      ? `\nNaturally mention: ${productName}${productDescription ? ` — ${productDescription}` : ""}`
      : "";

    const format = isThread
      ? `Create a Twitter thread of ${threadLength} tweets. Separate each tweet with ---`
      : "Create a single tweet (max 280 characters)";

    const userPrompt = `${format} about: ${topic}
Tone: ${tone}${productContext}${hashtagStr}

Generate now. Only output the tweet(s).`;

    const result = await callAI({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.8,
      maxTokens: isThread ? 1024 : 256,
    });

    const content = result.text;
    const parts = isThread ? content.split("---").map(s => s.trim()).filter(Boolean) : [content];

    return NextResponse.json({
      data: {
        content,
        isThread,
        threadParts: parts,
        hashtags,
        characterCount: parts[0]?.length || 0,
        method: "groq",
        model: result.model,
        tokens: result.inputTokens + result.outputTokens,
        message: isThread ? "AI-generated Twitter thread" : "AI-generated tweet",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate tweet", details: message },
      { status: 500 }
    );
  }
}

function generateTemplateTweet(opts: {
  topic: string;
  isThread: boolean;
  threadLength: number;
  hashtags: string[];
  productName?: string;
}): string {
  const { topic, isThread, threadLength, hashtags, productName } = opts;
  const hashtagStr = hashtags.length > 0 ? `\n\n${hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}` : "";

  if (!isThread) {
    const tweet = productName
      ? `Most people overcomplicate ${topic}.\n\nHere's the simple truth: focus on one thing, do it well, iterate.\n\n${productName} taught me this.${hashtagStr}`
      : `Most people overcomplicate ${topic}.\n\nHere's the simple truth: focus on one thing, do it well, iterate.${hashtagStr}`;
    return tweet.slice(0, 280);
  }

  const parts: string[] = [
    `Thread: Everything I've learned about ${topic} (from 100+ hours of research)\n\nYou won't find this in any textbook. 🧵👇`,
    `1/ The biggest mistake people make with ${topic}:\n\nThey try to do everything at once.\n\nInstead, pick ONE metric that matters and obsess over it.`,
    `2/ The framework that changed everything:\n\n• Define the problem clearly\n• Find 3 possible solutions\n• Test the cheapest one first\n• Iterate based on data, not opinions`,
    `3/ Tools that actually help:\n\n${productName ? `• ${productName} — for automating the boring stuff\n` : ""}• A simple spreadsheet for tracking\n• Weekly reviews (15 min max)\n• One dashboard to rule them all`,
  ];

  for (let i = parts.length; i < threadLength - 1; i++) {
    parts.push(`${i + 1}/ Another key insight about ${topic}:\n\nConsistency beats intensity. Do a little every day rather than a lot once a month.`);
  }

  parts.push(`${threadLength}/ TL;DR on ${topic}:\n\n• Start simple\n• Measure what matters\n• Iterate weekly\n• Don't overcomplicate it\n\nIf this was helpful, follow me for more threads like this. ♻️ Repost to help others.${hashtagStr}`);

  return parts.slice(0, threadLength).join("\n\n---\n\n");
}
