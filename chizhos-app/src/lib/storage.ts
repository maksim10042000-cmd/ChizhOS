/**
 * Драйверное хранилище файлов.
 * - Если заданы env S3_* / R2_* — загружает в S3-совместимое хранилище (Cloudflare R2, AWS S3, MinIO).
 * - Иначе (dev) — сохраняет в public/uploads и отдаёт локальный URL.
 * Так проект работает из коробки и переключается на R2/S3 без изменения кода UI.
 */

export interface SavedFile {
  url: string;
  name: string;
  mime: string;
  size: number;
}

export function isS3Configured(): boolean {
  return !!(
    process.env.S3_BUCKET &&
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  );
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

export async function saveFile(name: string, mime: string, buf: Buffer): Promise<SavedFile> {
  const key = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${sanitize(name)}`;

  if (isS3Configured()) {
    // R2 / S3 — server-side PutObject. Для больших файлов позже переходим на presigned direct-upload.
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
      },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET as string,
        Key: key,
        Body: buf,
        ContentType: mime,
      })
    );
    const base = (process.env.S3_PUBLIC_URL || "").replace(/\/$/, "");
    const url = base ? `${base}/${key}` : `s3://${process.env.S3_BUCKET}/${key}`;
    return { url, name, mime, size: buf.length };
  }

  // Локальный фолбэк
  const fs = await import("fs/promises");
  const path = await import("path");
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), buf);
  return { url: `/uploads/${key}`, name, mime, size: buf.length };
}
