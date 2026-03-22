import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/claude";

interface GenerateOutreachRequest {
  messageType: "connection_request" | "inmail" | "follow_up";
  recipientName: string;
  recipientTitle?: string;
  recipientCompany?: string;
  context?: string;
  productName?: string;
  productDescription?: string;
  tone?: "professional" | "casual" | "direct";
}

const SYSTEM_PROMPT = `You are an expert LinkedIn outreach specialist. Craft personalized messages that:

1. **Personalize immediately** — reference their role, company, or recent activity
2. **Lead with value** — what's in it for them, not what you want
3. **Keep it concise** — connection requests: 300 chars max, InMails: 500 chars ideal
4. **Have a clear soft CTA** — suggest a conversation, not a hard sell
5. **Sound human** — avoid buzzwords, templates, and salesy language

CONNECTION REQUEST RULES (300 char limit):
- One sentence about why you're connecting
- One sentence about shared interest or mutual value
- No pitching in connection requests

INMAIL RULES (2000 char limit):
- Brief personalized opening (1 line)
- Value proposition (2-3 lines)
- Soft CTA (1 line)
- Total: 4-6 lines max

FOLLOW-UP RULES:
- Reference the previous interaction
- Add new value (article, insight, introduction)
- Keep even shorter than the first message`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateOutreachRequest;
    const {
      messageType = "connection_request",
      recipientName,
      recipientTitle,
      recipientCompany,
      context,
      productName,
      productDescription,
      tone = "professional",
    } = body;

    if (!recipientName) {
      return NextResponse.json(
        { error: "recipientName is required" },
        { status: 400 }
      );
    }

    if (!isClaudeConfigured()) {
      const fallback = generateTemplateOutreach({ messageType, recipientName, recipientTitle, recipientCompany, productName });
      return NextResponse.json({
        data: {
          content: fallback,
          messageType,
          characterCount: fallback.length,
          method: "template",
          message: "Generated using templates (add ANTHROPIC_API_KEY for AI-powered messages)",
        },
      });
    }

    const recipientContext = [
      recipientTitle && `Title: ${recipientTitle}`,
      recipientCompany && `Company: ${recipientCompany}`,
      context && `Context: ${context}`,
    ].filter(Boolean).join("\n");

    const productContext = productName
      ? `\nYour product: ${productName}${productDescription ? ` — ${productDescription}` : ""}`
      : "";

    const charLimit = messageType === "connection_request" ? 300 : messageType === "inmail" ? 2000 : 1000;

    const userPrompt = `Write a LinkedIn ${messageType.replace("_", " ")} to ${recipientName}.
${recipientContext}${productContext}
Tone: ${tone}
Character limit: ${charLimit}

Generate the message now. Only output the message text.`;

    const result = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 512,
      temperature: 0.7,
    });

    const content = result.text;

    return NextResponse.json({
      data: {
        content,
        messageType,
        characterCount: content.length,
        method: "claude",
        tokens: result.inputTokens + result.outputTokens,
        message: "AI-generated outreach message",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate outreach message", details: message },
      { status: 500 }
    );
  }
}

function generateTemplateOutreach(opts: {
  messageType: string;
  recipientName: string;
  recipientTitle?: string;
  recipientCompany?: string;
  productName?: string;
}): string {
  const { messageType, recipientName, recipientTitle, recipientCompany, productName } = opts;

  if (messageType === "connection_request") {
    const role = recipientTitle ? ` Your work as ${recipientTitle}` : " Your profile";
    const at = recipientCompany ? ` at ${recipientCompany}` : "";
    return `Hi ${recipientName},${role}${at} caught my attention. I'm working in a similar space and would love to connect and exchange insights.`;
  }

  if (messageType === "follow_up") {
    return `Hi ${recipientName},\n\nFollowing up on my earlier message — I came across an article that reminded me of our conversation and thought you might find it valuable.\n\nWould you be open to a quick 15-min chat this week?`;
  }

  // InMail
  let msg = `Hi ${recipientName},\n\n`;
  if (recipientTitle && recipientCompany) {
    msg += `I noticed your work as ${recipientTitle} at ${recipientCompany} — impressive track record.\n\n`;
  }
  if (productName) {
    msg += `I'm building ${productName} and think it could be relevant to what you're working on.\n\n`;
  } else {
    msg += `I'm working on something I think could be relevant to your work.\n\n`;
  }
  msg += `Would you be open to a brief conversation? I'd love to share some insights that might be useful.\n\nBest regards`;
  return msg;
}
