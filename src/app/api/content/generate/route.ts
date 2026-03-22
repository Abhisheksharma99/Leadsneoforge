import { NextRequest, NextResponse } from "next/server";

import { callClaude, isClaudeConfigured, PRODUCT_CONTEXT } from "@/lib/claude";

interface ContentGenerateRequest {
  platform: string;
  contentType: string;
  topic: string;
  tone?: string;
  productName?: string;
  productDescription?: string;
  additionalContext?: string;
}

const PLATFORM_PROMPTS: Record<string, string> = {
  producthunt: `You are a Product Hunt launch expert. Create compelling content for Product Hunt launches:
- Taglines: 60 chars max, punchy, benefit-focused
- Maker comments: Authentic, tell the story, acknowledge the community
- Descriptions: Problem → Solution → Key features → Social proof`,

  hackernews: `You are a Hacker News content expert. Create content that resonates with the HN community:
- Show HN: Technical, honest about limitations, invite feedback
- Titles: Factual, no clickbait, no emojis
- Body: Technical depth, respect for reader intelligence, no marketing speak`,

  indiehackers: `You are an Indie Hackers community expert. Create authentic founder content:
- Transparent about revenue/metrics
- Share learnings, not just wins
- Practical advice from experience
- Community-first, self-promotion second`,

  email: `You are an email marketing expert. Create compelling email content:
- Subject lines: 40-60 chars, curiosity-driven
- Body: Personal, conversational, one clear CTA
- PS lines for secondary CTAs`,
};

const DEFAULT_PROMPT = `You are a content marketing expert. Create engaging content for the specified platform. Be authentic, provide value, and match the platform's culture and expectations.`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ContentGenerateRequest;
    const {
      platform,
      contentType,
      topic,
      tone = "professional",
      productName,
      productDescription,
      additionalContext,
    } = body;

    if (!platform || !topic) {
      return NextResponse.json(
        { error: "platform and topic are required" },
        { status: 400 }
      );
    }

    if (!isClaudeConfigured()) {
      const fallback = generateTemplateContent({ platform, contentType, topic, productName });
      return NextResponse.json({
        data: {
          content: fallback,
          platform,
          contentType,
          characterCount: fallback.length,
          method: "template",
          message: "Generated using templates (add ANTHROPIC_API_KEY for Claude-powered content)",
        },
      });
    }

    const systemPrompt = `${PLATFORM_PROMPTS[platform] || DEFAULT_PROMPT}\n\n${PRODUCT_CONTEXT}`;
    const productContext = productName
      ? `\nProduct: ${productName}${productDescription ? ` — ${productDescription}` : ""}`
      : "";
    const extra = additionalContext ? `\nAdditional context: ${additionalContext}` : "";

    const userPrompt = `Create ${contentType} content for ${platform} about: ${topic}
Tone: ${tone}${productContext}${extra}

Generate the content now. Only output the content.`;

    const result = await callClaude({
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    return NextResponse.json({
      data: {
        content: result.text,
        platform,
        contentType,
        characterCount: result.text.length,
        method: "claude",
        model: result.model,
        tokens: result.inputTokens + result.outputTokens,
        message: `Claude-generated ${platform} content`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate content", details: message },
      { status: 500 }
    );
  }
}

function generateTemplateContent(opts: {
  platform: string;
  contentType: string;
  topic: string;
  productName?: string;
}): string {
  const { platform, contentType, topic, productName } = opts;

  if (platform === "producthunt") {
    if (contentType === "tagline") {
      return productName
        ? `${productName} — The simplest way to ${topic.toLowerCase()}`
        : `The simplest way to ${topic.toLowerCase()}`;
    }
    if (contentType === "maker_comment") {
      return `Hey Product Hunt! 👋\n\nI've been working on ${productName || "this"} for the past few months, and today we're finally launching.\n\nThe problem: ${topic}\n\nWhat we built: A solution that makes this 10x easier.\n\nI'd love your honest feedback — what works, what doesn't, and what you'd want to see next.\n\nThanks for checking us out!`;
    }
    return `${productName || "Our product"} helps you ${topic.toLowerCase()}.\n\nKey features:\n• Feature 1 — Solves the core problem\n• Feature 2 — Saves time with automation\n• Feature 3 — Integrates with your workflow\n\nBuilt by makers who faced this problem daily.`;
  }

  if (platform === "hackernews") {
    return `Show HN: ${productName || topic}\n\nHi HN,\n\nI built ${productName || "a tool"} to address ${topic.toLowerCase()}.\n\nThe technical approach: We use [technology] to [solve problem] differently than existing solutions.\n\nWhat's different:\n- Point 1\n- Point 2\n- Point 3\n\nLimitations (being honest): This doesn't handle [edge case] yet.\n\nLooking for feedback on the technical architecture and UX. Happy to answer questions.`;
  }

  if (platform === "indiehackers") {
    return `How I'm approaching ${topic}\n\nBackground: I started ${productName || "building"} because [personal problem].\n\nCurrent metrics:\n- Users: Growing steadily\n- Revenue: Early stage\n- Main challenge: ${topic}\n\nWhat I've learned:\n1. Start smaller than you think\n2. Talk to users before building\n3. Ship fast, iterate faster\n\nWould love to hear from others tackling similar challenges.`;
  }

  return `Here's our approach to ${topic}:\n\n${productName ? `${productName} makes this easier by automating the key steps.\n\n` : ""}Key points:\n1. Start with the fundamentals\n2. Build a repeatable process\n3. Measure and iterate\n4. Scale what works\n\nThe details matter, but the framework stays the same.`;
}
