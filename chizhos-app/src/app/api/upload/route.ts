import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { saveFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 25 * 1024 * 1024; // 25 МБ

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Файл слишком большой (макс. 25 МБ)" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveFile(file.name, file.type || "application/octet-stream", buf);
  return NextResponse.json(saved);
}
