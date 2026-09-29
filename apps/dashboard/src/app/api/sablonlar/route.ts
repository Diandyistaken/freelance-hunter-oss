import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { ROOT } from "@/lib/hunter";

export const dynamic = "force-dynamic";

interface Sablon {
  id: string;
  ad: string;
  aciklama: string;
}

export async function GET() {
  try {
    const file = path.join(ROOT, "templates", "business-landing", "catalog.json");
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(parsed)) return NextResponse.json([]);

    const gecerli = parsed.every(
      (item): item is Sablon =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Sablon).id === "string" &&
        typeof (item as Sablon).ad === "string" &&
        typeof (item as Sablon).aciklama === "string",
    );
    return NextResponse.json(gecerli ? parsed : []);
  } catch {
    return NextResponse.json([]);
  }
}
