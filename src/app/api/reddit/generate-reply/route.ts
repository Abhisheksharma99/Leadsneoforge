import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

interface GenerateReplyRequest {
  postTitle: string;
  postContent: string;
  subreddit: string;
  postAuthor: string;
  productName?: string;
  productDescription?: string;
  productUrl?: string;
  tone?: "helpful" | "casual" | "technical" | "enthusiastic";
  replyType?: "comment" | "dm" | "standalone_post";
}

const SYSTEM_PROMPT = `You are an expert Reddit community marketer. Your job is to craft replies to Reddit posts that:

1. **Genuinely engage** with the original post's question/problem first
2. **Provide real value** — answer the question, share experience, give useful context
3. **Naturally weave in** a product mention only where it's relevant and helpful
4. **Never sound promotional** — write like a real community member who happens to know about a useful tool
5. **Match the subreddit culture** — technical subs need technical depth, casual subs need casual tone
6. **Use appropriate length** — most Reddit comments are 2-5 paragraphs, not walls of text

FORMAT RULES:
- Use Reddit markdown (bold with **, links with [text](url), bullet points with -)
- Start by addressing the poster's actual problem/question
- Only mention the product if it genuinely solves their problem
- If the product isn't relevant, give a helpful answer anyway with no product mention
- End naturally, don't use "hope this helps!" or other canned closers
- Never use phrases like "I'm not affiliated" or "not sponsored" (these scream shill)
- Write in first person as if you've personally used or explored the tool

ANTI-SPAM RULES:
- No exclamation marks overload
- No "game changer" or "revolutionary" language
- No direct "check out [product]!" calls to action
- If mentioning the product, frame it as "I've been using X for..." or "something like X might work here"
- Keep the product mention to 1-2 sentences max within a longer helpful reply`;

/**
 * POST /api/reddit/generate-reply
 *
 * Generates a contextual, non-promotional reply to a Reddit post
 * that naturally incorporates product awareness.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateReplyRequest;
    const {
      postTitle,
      postContent,
      subreddit,
      postAuthor,
      productName,
      productDescription,
      productUrl,
      tone = "helpful",
      replyType = "comment",
    } = body;

    if (!postTitle) {
      return NextResponse.json(
        { error: "postTitle is required" },
        { status: 400 }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      // Generate a template-based reply without AI
      const fallbackReply = generateTemplatereply({
        postTitle,
        postContent,
        subreddit,
        productName,
        productDescription,
        productUrl,
        tone,
      });
      return NextResponse.json({
        data: {
          reply: fallbackReply,
          method: "template",
          message: "Generated using templates (add ANTHROPIC_API_KEY for AI-powered replies)",
        },
      });
    }

    const toneGuide: Record<string, string> = {
      helpful: "Be genuinely helpful and knowledgeable. Focus on solving the problem.",
      casual: "Be casual and friendly, like chatting with a fellow hobbyist.",
      technical: "Be technically precise. Include specifics, versions, comparisons.",
      enthusiastic: "Be genuinely excited but not over-the-top. Share passion authentically.",
    };

    const replyTypeGuide: Record<string, string> = {
      comment: "Write a Reddit comment reply to this post.",
      dm: "Write a friendly direct message to this user about their post.",
      standalone_post: "Write a new Reddit post for this subreddit inspired by the topic.",
    };

    const productContext = productName
      ? `\n\nPRODUCT CONTEXT (only mention if genuinely relevant):\n- Name: ${productName}\n- Description: ${productDescription || "N/A"}\n- URL: ${productUrl || "N/A"}`
      : "\n\nNo specific product to promote. Just give a genuinely helpful answer.";

    const userPrompt = `${replyTypeGuide[replyType]}

SUBREDDIT: r/${subreddit}
POST AUTHOR: u/${postAuthor}
POST TITLE: ${postTitle}
POST CONTENT: ${postContent || "(no body text)"}

TONE: ${toneGuide[tone]}
${productContext}

Generate the reply now. Only output the reply text, nothing else.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const completion = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const reply = completion.content?.[0]?.text?.trim() || "";
    const totalTokens = completion.usage
      ? completion.usage.input_tokens + completion.usage.output_tokens
      : undefined;

    return NextResponse.json({
      data: {
        reply,
        method: "claude",
        model: ANTHROPIC_MODEL,
        tokens: totalTokens,
        message: "Claude-generated contextual reply",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate reply", details: message },
      { status: 500 }
    );
  }
}

/**
 * Template-based reply generation (fallback when no OpenAI key)
 */
function generateTemplatereply(opts: {
  postTitle: string;
  postContent: string;
  subreddit: string;
  productName?: string;
  productDescription?: string;
  productUrl?: string;
  tone: string;
}): string {
  const { postTitle, subreddit, productName, productDescription, productUrl } = opts;
  const titleLower = postTitle.toLowerCase();

  // Detect post intent
  const isQuestion = titleLower.includes("?") || titleLower.startsWith("how") || titleLower.startsWith("what") || titleLower.startsWith("which") || titleLower.startsWith("any");
  const isLookingFor = titleLower.includes("looking for") || titleLower.includes("alternative") || titleLower.includes("recommend") || titleLower.includes("suggestion");
  const isProblem = titleLower.includes("help") || titleLower.includes("issue") || titleLower.includes("problem") || titleLower.includes("struggling");

  let reply = "";

  if (isQuestion || isLookingFor) {
    reply = `Great question! This comes up a lot in r/${subreddit}.\n\n`;
    reply += `From my experience, the answer really depends on your specific use case and what you're prioritizing — cost, features, ease of use, or compatibility.\n\n`;
    if (productName) {
      reply += `I've been exploring **${productName}** recently${productDescription ? ` — ${productDescription.toLowerCase()}` : ""}. It might be worth checking out depending on your needs.${productUrl ? ` More info at ${productUrl}` : ""}\n\n`;
    }
    reply += `What's your main priority here? That would help narrow down the best options.`;
  } else if (isProblem) {
    reply += `I ran into something similar a while back. What helped me was breaking the problem down step by step.\n\n`;
    reply += `Could you share more details about your setup? That would make it easier to point you in the right direction.\n\n`;
    if (productName) {
      reply += `Depending on your workflow, something like **${productName}** might streamline things${productDescription ? ` — it ${productDescription.toLowerCase()}` : ""}.${productUrl ? ` [Link](${productUrl})` : ""}`;
    }
  } else {
    reply += `Interesting post! Thanks for sharing this with r/${subreddit}.\n\n`;
    reply += `This resonates with what I've been seeing in the space lately. `;
    if (productName) {
      reply += `Actually, I've been working with **${productName}**${productDescription ? ` (${productDescription.toLowerCase()})` : ""} and it connects to this topic in an interesting way.${productUrl ? ` Worth a look: ${productUrl}` : ""}`;
    } else {
      reply += `Would love to hear more about your experience with this.`;
    }
  }

  return reply;
}
