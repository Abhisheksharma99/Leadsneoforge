import { NextRequest, NextResponse } from "next/server";
import { callClaude, isClaudeConfigured } from "@/lib/claude";

interface GenerateSequenceRequest {
  platform: "linkedin" | "twitter" | "email" | "reddit";
  goal: string;
  steps?: number;
  productName?: string;
  productDescription?: string;
  targetAudience?: string;
}

const SYSTEM_PROMPT = `You are an outreach sequence expert. Design multi-step outreach sequences that convert.

OUTPUT FORMAT (JSON):
{
  "name": "Sequence Name",
  "description": "Brief description",
  "steps": [
    {
      "day": 0,
      "channel": "platform",
      "action": "What to do",
      "messageTemplate": "The actual message template with {name} and {company} variables",
      "waitDays": 3
    }
  ]
}

RULES:
- Each step should build on the previous one
- Include {name}, {company}, {title} as variables where appropriate
- Vary the approach: value → social proof → urgency → last chance
- Respect platform norms (LinkedIn: professional, Twitter: casual, Email: flexible)
- Space steps 2-7 days apart
- LinkedIn sequence: connection → value → pitch → follow-up → break-up
- Twitter sequence: follow → engage → DM → follow-up
- Email sequence: cold → value → case study → demo → break-up → re-engage
- Reddit sequence: engage → value post → DM → community post

Return ONLY the JSON object, no other text.`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateSequenceRequest;
    const {
      platform = "linkedin",
      goal,
      steps = 5,
      productName,
      productDescription,
      targetAudience,
    } = body;

    if (!goal) {
      return NextResponse.json(
        { error: "goal is required" },
        { status: 400 }
      );
    }

    if (!isClaudeConfigured()) {
      const fallback = generateTemplateSequence({ platform, goal, steps, productName });
      return NextResponse.json({
        data: {
          ...fallback,
          method: "template",
          message: "Generated using templates (add ANTHROPIC_API_KEY for AI-powered sequences)",
        },
      });
    }

    const productContext = productName
      ? `\nProduct: ${productName}${productDescription ? ` — ${productDescription}` : ""}`
      : "";
    const audienceContext = targetAudience ? `\nTarget audience: ${targetAudience}` : "";

    const userPrompt = `Create a ${steps}-step ${platform} outreach sequence.
Goal: ${goal}${productContext}${audienceContext}

Generate the JSON now.`;

    const result = await callClaude({
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    const raw = result.text || "{}";
    let sequence;
    try {
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      sequence = JSON.parse(cleaned);
    } catch {
      sequence = generateTemplateSequence({ platform, goal, steps, productName });
    }

    return NextResponse.json({
      data: {
        ...sequence,
        platform,
        method: "claude",
        tokens: result.inputTokens + result.outputTokens,
        message: "AI-generated outreach sequence",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate sequence", details: message },
      { status: 500 }
    );
  }
}

function generateTemplateSequence(opts: {
  platform: string;
  goal: string;
  steps: number;
  productName?: string;
}) {
  const { platform, goal, productName } = opts;

  const sequences: Record<string, { name: string; description: string; steps: Array<{ day: number; channel: string; action: string; messageTemplate: string; waitDays: number }> }> = {
    linkedin: {
      name: "LinkedIn Warm Outreach",
      description: `${goal} via LinkedIn connection building`,
      steps: [
        { day: 0, channel: "linkedin", action: "Send connection request", messageTemplate: `Hi {name}, I noticed your work as {title} at {company}. I'm exploring similar challenges in the space and would love to connect.`, waitDays: 3 },
        { day: 3, channel: "linkedin", action: "Share value content", messageTemplate: `Hi {name}, thanks for connecting! I came across this article about ${goal.toLowerCase()} and thought you might find it interesting given your role at {company}.`, waitDays: 4 },
        { day: 7, channel: "linkedin", action: "Soft pitch", messageTemplate: `Hi {name}, I've been working on ${productName || "a solution"} that addresses some of the challenges we discussed. Would you be open to a quick look?`, waitDays: 5 },
        { day: 12, channel: "linkedin", action: "Follow up with social proof", messageTemplate: `Hi {name}, quick follow-up — we recently helped a company similar to {company} achieve [result]. Thought it might be relevant to you.`, waitDays: 7 },
        { day: 19, channel: "linkedin", action: "Breakup message", messageTemplate: `Hi {name}, I don't want to be a bother so this will be my last message. If ${goal.toLowerCase()} ever becomes a priority, I'd love to chat. Wishing you and the {company} team all the best!`, waitDays: 0 },
      ],
    },
    twitter: {
      name: "Twitter Engagement Sequence",
      description: `${goal} through Twitter engagement`,
      steps: [
        { day: 0, channel: "twitter", action: "Follow and like recent tweets", messageTemplate: "Follow {name} and engage with their last 2-3 tweets with thoughtful replies.", waitDays: 2 },
        { day: 2, channel: "twitter", action: "Reply to their tweet with value", messageTemplate: "Add a genuinely helpful reply to their next relevant tweet. Share a specific insight or resource.", waitDays: 3 },
        { day: 5, channel: "twitter", action: "Send DM", messageTemplate: `Hey {name}! Loved your recent thread about [topic]. I've been working on ${productName || "something"} in the same space. Would love to chat.`, waitDays: 5 },
      ],
    },
    email: {
      name: "Cold Email Sequence",
      description: `${goal} via targeted email outreach`,
      steps: [
        { day: 0, channel: "email", action: "Send cold email", messageTemplate: `Subject: Quick question about {company}'s approach to ${goal.toLowerCase()}\n\nHi {name},\n\nI noticed {company} is working on [specific thing]. We've been helping similar companies with ${goal.toLowerCase()}${productName ? ` using ${productName}` : ""}.\n\nWould a 15-min chat be useful?\n\nBest,\n[Your name]`, waitDays: 3 },
        { day: 3, channel: "email", action: "Follow up with value", messageTemplate: `Subject: Re: Quick question\n\nHi {name},\n\nJust wanted to follow up and share this [resource/case study] about ${goal.toLowerCase()} that might be relevant to {company}.\n\nNo pressure — just thought it could be useful.\n\nBest,\n[Your name]`, waitDays: 4 },
        { day: 7, channel: "email", action: "Social proof email", messageTemplate: `Subject: How [similar company] achieved [result]\n\nHi {name},\n\nWe recently helped [company] achieve [specific result] with their ${goal.toLowerCase()} efforts.\n\nWould it make sense to show you how?\n\nBest,\n[Your name]`, waitDays: 5 },
        { day: 12, channel: "email", action: "Demo offer", messageTemplate: `Subject: 5-min demo for {company}\n\nHi {name},\n\nI put together a quick 5-min walkthrough specifically for {company}'s use case.\n\nWorth a look?\n\nBest,\n[Your name]`, waitDays: 7 },
        { day: 19, channel: "email", action: "Breakup email", messageTemplate: `Subject: Should I close your file?\n\nHi {name},\n\nI haven't heard back, so I'll assume the timing isn't right.\n\nIf ${goal.toLowerCase()} ever becomes a priority, my inbox is always open.\n\nAll the best to you and the {company} team.\n\n[Your name]`, waitDays: 0 },
      ],
    },
    reddit: {
      name: "Reddit Community Sequence",
      description: `${goal} through Reddit community engagement`,
      steps: [
        { day: 0, channel: "reddit", action: "Engage in relevant threads", messageTemplate: "Find 3-5 relevant posts and leave genuinely helpful comments. No product mentions yet.", waitDays: 3 },
        { day: 3, channel: "reddit", action: "Share value post", messageTemplate: `Create a value-first post: "Here's what I learned about ${goal.toLowerCase()}" with genuine insights and tips.`, waitDays: 4 },
        { day: 7, channel: "reddit", action: "Soft mention in reply", messageTemplate: `Reply to a relevant question and naturally mention ${productName || "your solution"} as one option among several.`, waitDays: 7 },
        { day: 14, channel: "reddit", action: "Community contribution", messageTemplate: `Post a tutorial, comparison, or resource list related to ${goal.toLowerCase()}. Position yourself as a helpful community member.`, waitDays: 0 },
      ],
    },
  };

  return sequences[platform] || sequences.linkedin;
}
