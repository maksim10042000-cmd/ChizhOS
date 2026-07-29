import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-1px" }}>404</div>
        <div className="muted" style={{ fontSize: 14, margin: "6px 0 16px" }}>Страница не найдена</div>
        <Link href="/" className="btn">На главную</Link>
      </div>
    </div>
  );
}
