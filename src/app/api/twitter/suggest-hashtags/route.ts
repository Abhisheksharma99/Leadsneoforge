import { NextRequest, NextResponse } from "next/server";

import { callClaude, isClaudeConfigured } from "@/lib/claude";

interface SuggestHashtagsRequest {
  topic: string;
  platform?: "twitter" | "linkedin";
  count?: number;
}

const SYSTEM_PROMPT = `You are a social media hashtag research expert. When given a topic, suggest relevant hashtags with estimated engagement volume.

OUTPUT FORMAT (JSON array):
[
  { "hashtag": "#example", "volume": "high", "relevance": 95, "trending": true },
  ...
]

RULES:
- Return exactly the requested number of hashtags
- volume: "high" (100k+ posts), "medium" (10k-100k), "low" (1k-10k), "niche" (<1k)
- relevance: 0-100 score based on topic match
- trending: true if currently trending or growing
- Mix broad and niche hashtags
- Include industry-specific and general hashtags
- For Twitter: prefer shorter hashtags, 3-5 per tweet
- For LinkedIn: prefer professional/industry hashtags, 3-8 per post
- Return ONLY the JSON array, no other text`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SuggestHashtagsRequest;
    const { topic, platform = "twitter", count = 10 } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    if (!isClaudeConfigured()) {
      const fallback = generateTemplateHashtags(topic, platform, count);
      return NextResponse.json({
        data: {
          suggestions: fallback,
          topic,
          platform,
          method: "template",
          message: "Generated using templates (add ANTHROPIC_API_KEY for Claude-powered suggestions)",
        },
      });
    }

    const userPrompt = `Suggest ${count} hashtags for ${platform} about: ${topic}

Return the JSON array now.`;

    const result = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.6,
      maxTokens: 512,
    });

    let suggestions;
    try {
      const cleaned = result.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      suggestions = generateTemplateHashtags(topic, platform, count);
    }

    return NextResponse.json({
      data: {
        suggestions,
        topic,
        platform,
        method: "claude",
        model: result.model,
        tokens: result.inputTokens + result.outputTokens,
        message: "Claude-generated hashtag suggestions",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to suggest hashtags", details: message },
      { status: 500 }
    );
  }
}

function generateTemplateHashtags(topic: string, platform: string, count: number) {
  const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const topicCamel = topic.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");

  const baseHashtags = [
    { hashtag: `#${topicCamel}`, volume: "medium" as const, relevance: 95, trending: false },
    { hashtag: `#${topicSlug}`, volume: "medium" as const, relevance: 90, trending: false },
    { hashtag: "#startup", volume: "high" as const, relevance: 70, trending: false },
    { hashtag: "#tech", volume: "high" as const, relevance: 65, trending: false },
    { hashtag: "#innovation", volume: "high" as const, relevance: 60, trending: false },
    { hashtag: "#productivity", volume: "high" as const, relevance: 55, trending: false },
    { hashtag: "#buildinpublic", volume: "medium" as const, relevance: 75, trending: true },
    { hashtag: "#saas", volume: "medium" as const, relevance: 70, trending: false },
    { hashtag: "#growthhacking", volume: "medium" as const, relevance: 65, trending: false },
    { hashtag: "#marketing", volume: "high" as const, relevance: 60, trending: false },
    { hashtag: "#entrepreneurship", volume: "high" as const, relevance: 55, trending: false },
    { hashtag: "#automation", volume: "medium" as const, relevance: 70, trending: true },
  ];

  if (platform === "linkedin") {
    baseHashtags.push(
      { hashtag: "#leadership", volume: "high" as const, relevance: 50, trending: false },
      { hashtag: "#business", volume: "high" as const, relevance: 55, trending: false },
    );
  }

  return baseHashtags.slice(0, count);
}
