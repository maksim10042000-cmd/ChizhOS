"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Пользователи" },
  { href: "/admin/parks", label: "Автопарки" },
  { href: "/admin/settings", label: "Настройки" },
  { href: "/admin/backup", label: "Резервное копирование" },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="admin-tabs">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={"admin-tab" + (active ? " on" : "")}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
