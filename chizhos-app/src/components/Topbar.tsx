"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

export default function Topbar({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  // Часы рисуются только после монтирования: на сервере и на клиенте время
  // отличается, и без этого React ругался бы на несовпадение разметки.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const date = now
    ? cap(now.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long", year: "numeric" }))
    : "";
  const time = now ? now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  return (
    <div className="topbar">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="page-title">{title}</div>
        <div className="page-sub">{sub}</div>
      </div>
      {action}
      <div className="topbar-clock">
        <Icon name="cal" size={15} color="#6b7280" />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>{date}</span>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: ".4px", fontVariantNumeric: "tabular-nums" }}>
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}
