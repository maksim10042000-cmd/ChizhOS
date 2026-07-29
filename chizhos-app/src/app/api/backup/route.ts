import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exportData } from "@/lib/data/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Требуются права администратора" }, { status: 403 });
  }

  const data = JSON.stringify(await exportData(), null, 2);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="chizhos-backup-${stamp}.json"`,
    },
  });
}
