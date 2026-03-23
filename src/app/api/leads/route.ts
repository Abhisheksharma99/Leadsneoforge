import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

type LeadStatus = "new" | "contacted" | "replied" | "qualified" | "converted" | "lost";

interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  platform: string;
  status: LeadStatus;
  score: number;
  notes?: string;
  addedAt: string;
  lastContactedAt?: string;
}

// ─── File helpers ────────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || process.cwd() + "/data";

const LEADS_FILE = path.join(DATA_DIR, "leads.json");

async function readLeads(): Promise<Lead[]> {
  try {
    const content = await fs.readFile(LEADS_FILE, "utf-8");
    return JSON.parse(content) as Lead[];
  } catch {
    return [];
  }
}

async function writeLeads(leads: Lead[]): Promise<void> {
  await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
}

// ─── GET /api/leads — list all leads ─────────────────────────────────────────

export async function GET() {
  try {
    const leads = await readLeads();
    return NextResponse.json({ data: leads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read leads", details: message },
      { status: 500 }
    );
  }
}

// ─── POST /api/leads — create one lead or bulk-create an array ──────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const leads = await readLeads();

    // Support bulk creation: body can be a single object or an array
    const incoming: Partial<Lead>[] = Array.isArray(body) ? body : [body];

    if (incoming.length === 0) {
      return NextResponse.json(
        { error: "Request body must be a lead object or an array of leads" },
        { status: 400 }
      );
    }

    const created: Lead[] = [];

    for (const item of incoming) {
      if (!item.name || !item.company) {
        return NextResponse.json(
          { error: "Each lead requires at least name and company" },
          { status: 400 }
        );
      }

      const newLead: Lead = {
        id: item.id || crypto.randomUUID(),
        name: item.name,
        title: item.title || "",
        company: item.company,
        platform: item.platform || "email",
        status: item.status || "new",
        score: item.score ?? 0,
        notes: item.notes || undefined,
        addedAt: item.addedAt || new Date().toISOString(),
        lastContactedAt: item.lastContactedAt || undefined,
      };

      leads.push(newLead);
      created.push(newLead);
    }

    await writeLeads(leads);

    // Return single object when one lead was created, array for bulk
    const data = created.length === 1 ? created[0] : created;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create lead(s)", details: message },
      { status: 500 }
    );
  }
}

// ─── PUT /api/leads — update an existing lead ───────────────────────────────

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

    const leads = await readLeads();
    const index = leads.findIndex((l) => l.id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    leads[index] = { ...leads[index], ...updates };
    await writeLeads(leads);

    return NextResponse.json({ data: leads[index] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update lead", details: message },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/leads — delete a lead by id (query param) ──────────────────

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

    const leads = await readLeads();
    const filtered = leads.filter((l) => l.id !== id);

    if (filtered.length === leads.length) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    await writeLeads(filtered);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete lead", details: message },
      { status: 500 }
    );
  }
}
