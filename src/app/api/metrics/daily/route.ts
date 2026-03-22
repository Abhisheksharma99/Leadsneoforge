import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { parseDailyMetricsCSV } from "@/lib/parsers";

const DATA_DIR = process.env.DATA_DIR || "./data";

export async function GET() {
  try {
    const filePath = path.join(DATA_DIR, "daily-metrics.csv");
    const fileContent = await fs.readFile(filePath, "utf-8");
    const metrics = parseDailyMetricsCSV(fileContent);

    return NextResponse.json({ data: metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read daily metrics", details: message },
      { status: 500 }
    );
  }
}
