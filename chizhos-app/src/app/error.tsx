"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="card-title" style={{ color: "var(--red)" }}>Произошла ошибка</div>
        <div style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", marginBottom: 14 }}>
          {error?.message || "Неизвестная ошибка"}
        </div>
        <button className="btn" onClick={reset}>Повторить</button>
      </div>
    </div>
  );
}
