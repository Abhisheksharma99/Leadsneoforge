import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

type CampaignStatus = "draft" | "active" | "paused" | "completed";

interface CampaignTask {
  id: string;
  title: string;
  channel: string;
  status: "pending" | "in_progress" | "done";
  dueDate?: string;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  channels: string[];
  startDate: string;
  endDate?: string;
  budget?: string;
  kpis: {
    impressions: number;
    clicks: number;
    conversions: number;
    engagement: number;
  };
  tasks: CampaignTask[];
  createdAt: string;
}

// ─── File helpers ────────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || process.cwd() + "/data";

const CAMPAIGNS_FILE = path.join(DATA_DIR, "campaigns.json");

async function readCampaigns(): Promise<Campaign[]> {
  try {
    const content = await fs.readFile(CAMPAIGNS_FILE, "utf-8");
    return JSON.parse(content) as Campaign[];
  } catch {
    return [];
  }
}

async function writeCampaigns(campaigns: Campaign[]): Promise<void> {
  await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2), "utf-8");
}

// ─── GET /api/campaigns — list all campaigns ─────────────────────────────────

export async function GET() {
  try {
    const campaigns = await readCampaigns();
    return NextResponse.json({ data: campaigns });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read campaigns", details: message },
      { status: 500 }
    );
  }
}

// ─── POST /api/campaigns — create a new campaign ────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, status, channels, startDate, endDate, budget, kpis, tasks } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: "name and description are required" },
        { status: 400 }
      );
    }

    const campaigns = await readCampaigns();

    const newCampaign: Campaign = {
      id: crypto.randomUUID(),
      name,
      description,
      status: status || "draft",
      channels: channels || [],
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || undefined,
      budget: budget || undefined,
      kpis: kpis || {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        engagement: 0,
      },
      tasks: (tasks || []).map((t: Partial<CampaignTask>) => ({
        id: t.id || crypto.randomUUID(),
        title: t.title || "",
        channel: t.channel || "",
        status: t.status || "pending",
        dueDate: t.dueDate || undefined,
      })),
      createdAt: new Date().toISOString(),
    };

    campaigns.push(newCampaign);
    await writeCampaigns(campaigns);

    return NextResponse.json({ data: newCampaign }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create campaign", details: message },
      { status: 500 }
    );
  }
}

// ─── PUT /api/campaigns — update an existing campaign ───────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const campaigns = await readCampaigns();
    const index = campaigns.findIndex((c) => c.id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    campaigns[index] = { ...campaigns[index], ...updates };
    await writeCampaigns(campaigns);

    return NextResponse.json({ data: campaigns[index] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update campaign", details: message },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/campaigns — delete a campaign by id (query param) ──────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    const campaigns = await readCampaigns();
    const filtered = campaigns.filter((c) => c.id !== id);

    if (filtered.length === campaigns.length) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    await writeCampaigns(filtered);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete campaign", details: message },
      { status: 500 }
    );
  }
}
