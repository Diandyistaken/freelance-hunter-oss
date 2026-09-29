import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Radar motoru (Python) data/radar.json'a yazar; dashboard buradan okur
export async function GET() {
  try {
    const p = path.join(process.cwd(), "..", "..", "data", "radar.json");
    const raw = await fs.readFile(p, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ hits: [] });
  }
}
