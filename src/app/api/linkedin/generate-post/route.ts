import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/claude";

interface GenerateLinkedInPostRequest {
  postType: "text" | "article" | "carousel" | "poll";
  topic: string;
  tone?: "professional" | "thought_leader" | "storytelling" | "educational";
  productName?: string;
  productDescription?: string;
  hashtags?: string[];
}

const SYSTEM_PROMPT = `You are an expert LinkedIn content strategist. Create engaging LinkedIn posts that:

1. **Hook in the first line** — start with a bold statement, question, or surprising fact
2. **Use short paragraphs** — 1-2 sentences max per paragraph for readability
3. **Add line breaks** — LinkedIn rewards white space and scannable content
4. **Include a clear CTA** — ask a question, invite comments, or share a resource
5. **Sound authentic** — write like a real professional sharing insights, not a marketing bot
6. **Stay under 3000 characters** — optimal length is 1200-1500 characters

FORMAT BY POST TYPE:
- text: Standard thought leadership post with line breaks
- article: Long-form intro paragraph (the article body would be linked)
- carousel: Slide-by-slide content (numbered, one key point per slide, 10-12 slides)
- poll: A compelling question with 4 poll options and context paragraph

TONE GUIDE:
- professional: Polished, data-driven, industry-focused
- thought_leader: Bold opinions, future predictions, contrarian takes
- storytelling: Personal anecdotes, lessons learned, vulnerability
- educational: Step-by-step, frameworks, actionable tips`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateLinkedInPostRequest;
    const {
      postType = "text",
      topic,
      tone = "professional",
      productName,
      productDescription,
      hashtags = [],
    } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    if (!isClaudeConfigured()) {
      const fallback = generateTemplatePost({ postType, topic, productName, productDescription, hashtags });
      return NextResponse.json({
        data: {
          content: fallback,
          postType,
          hashtags,
          characterCount: fallback.length,
          method: "template",
          message: "Generated using templates (add ANTHROPIC_API_KEY for AI-powered posts)",
        },
      });
    }

    const hashtagStr = hashtags.length > 0 ? `\n\nInclude these hashtags: ${hashtags.join(" ")}` : "";
    const productContext = productName
      ? `\n\nNaturally mention: ${productName}${productDescription ? ` — ${productDescription}` : ""}`
      : "";

    const userPrompt = `Create a LinkedIn ${postType} post about: ${topic}
Tone: ${tone}${productContext}${hashtagStr}

Generate the post now. Only output the post content.`;

    const result = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    const content = result.text;

    return NextResponse.json({
      data: {
        content,
        postType,
        hashtags,
        characterCount: content.length,
        method: "claude",
        tokens: result.inputTokens + result.outputTokens,
        message: "AI-generated LinkedIn post",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate LinkedIn post", details: message },
      { status: 500 }
    );
  }
}

function generateTemplatePost(opts: {
  postType: string;
  topic: string;
  productName?: string;
  productDescription?: string;
  hashtags: string[];
}): string {
  const { postType, topic, productName, hashtags } = opts;
  const hashtagStr = hashtags.length > 0 ? `\n\n${hashtags.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}` : "";

  if (postType === "carousel") {
    return `Slide 1: ${topic} — What most people get wrong\n\nSlide 2: The real problem isn't what you think\n\nSlide 3: Here's what the data shows\n\nSlide 4: Step 1 — Start with the fundamentals\n\nSlide 5: Step 2 — Build your framework\n\nSlide 6: Step 3 — Test and iterate\n\nSlide 7: Step 4 — Scale what works\n\nSlide 8: The results speak for themselves\n\nSlide 9: Key takeaway\n\nSlide 10: Want to learn more? Follow for daily insights on ${topic}${hashtagStr}`;
  }

  if (postType === "poll") {
    return `What's the biggest challenge you face with ${topic}?\n\nI've been talking to dozens of professionals about this, and the answers might surprise you.\n\nHere are the top 4 responses I keep hearing:\n\n🔵 Lack of time/resources\n🔵 No clear strategy\n🔵 Too many tools, not enough integration\n🔵 Measuring ROI effectively\n\nDrop your answer below and share why — I'm compiling insights to share next week.${hashtagStr}`;
  }

  let post = `I've been thinking a lot about ${topic} lately.\n\nAnd here's what I've realized:\n\nMost people approach it completely wrong.\n\nThey focus on the tactics before nailing the strategy.\n\nHere's what actually works:\n\n1. Start with your end goal\n2. Work backward to identify key milestones\n3. Build systems, not just plans\n4. Measure what matters, ignore vanity metrics\n5. Iterate weekly, not monthly\n\n`;

  if (productName) {
    post += `Tools like ${productName} can help streamline this process, but the mindset shift matters more than any tool.\n\n`;
  }

  post += `What's your approach to ${topic}? I'd love to hear different perspectives.${hashtagStr}`;

  return post;
}
