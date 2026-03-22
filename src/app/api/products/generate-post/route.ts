import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Product } from "@/types";
import { callAI, isAIConfigured } from "@/lib/ai";

const DATA_DIR =
  process.env.DATA_DIR || process.cwd() + "/data";

const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

async function readProducts(): Promise<Product[]> {
  try {
    const content = await fs.readFile(PRODUCTS_FILE, "utf-8");
    return JSON.parse(content) as Product[];
  } catch {
    return [];
  }
}

/**
 * POST /api/products/generate-post
 *
 * Accepts { productId, subreddit } and generates a Reddit post
 * title + body for the given product/subreddit combination.
 */
export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { productId, subreddit } = reqBody;

    if (!productId || !subreddit) {
      return NextResponse.json(
        { error: "productId and subreddit are required" },
        { status: 400 }
      );
    }

    const products = await readProducts();
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (isAIConfigured()) {
      // AI generation via Groq
      try {
        const systemPrompt = `You are a Reddit marketing expert. Generate an authentic, non-promotional Reddit post for r/${subreddit}. The post should provide genuine value while naturally mentioning the product. Do NOT make it look like an ad. Write in a conversational tone that fits r/${subreddit}.

Return JSON with exactly these fields:
{ "title": "post title", "body": "post body text (supports markdown)" }

Return ONLY the JSON object, no other text.`;

        const userPrompt = `Generate a Reddit post for r/${subreddit} that naturally incorporates this product:

Product: ${product.name}
Tagline: ${product.tagline}
Description: ${product.description}
URL: ${product.url}
Key Features: ${product.features.join(", ")}
Keywords: ${product.keywords.join(", ")}`;

        const result = await callAI({
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.8,
          maxTokens: 1024,
        });

        const cleaned = result.text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        return NextResponse.json({
          data: {
            title: parsed.title,
            body: parsed.body,
            method: "groq",
          },
        });
      } catch (aiErr) {
        console.error("AI generation failed, falling back to template:", aiErr);
        // Fall through to template
      }
    }

    // Template fallback
    const title = `${product.name}: ${product.tagline || product.description.substring(0, 80)}`;
    const postBody = `Hey r/${subreddit}!\n\nI wanted to share ${product.name} — ${product.description}\n\n**Key Features:**\n${product.features.map((f) => `- ${f}`).join("\n")}\n\nCheck it out: ${product.url}\n\nWould love to hear your thoughts and feedback!`;

    return NextResponse.json({
      data: {
        title,
        body: postBody,
        method: "template",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate post", details: message },
      { status: 500 }
    );
  }
}
