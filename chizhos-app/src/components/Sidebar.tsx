"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { logoutAction } from "@/lib/actions";
import { ROLE_LABELS, SECTIONS, sectionsFor, type Session, type Severity } from "@/lib/types";

const LEVELS: { key: Severity; cls: string; title: string }[] = [
  { key: "critical", cls: "red", title: "Критические" },
  { key: "warning", cls: "amber", title: "Предупреждения" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Sidebar({
  session,
  counts,
  orgName,
  parkName,
}: {
  session: Session;
  counts: Record<Severity, number>;
  orgName: string;
  parkName: string | null;
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  // На узких экранах меню превращается в выдвижную панель.
  const [open, setOpen] = useState(false);

  // После перехода по ссылке панель должна закрыться сама.
  useEffect(() => setOpen(false), [pathname]);

  const isAdmin = session.role === "admin";
  const allowed = sectionsFor(session.role, session.permissions);
  const nav = SECTIONS.filter((s) => allowed.includes(s.key));
  const totalBadges = counts.critical + counts.warning;

  return (
    <>
      <button
        className="nav-toggle"
        aria-label="Открыть меню"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={20} />
        {totalBadges > 0 && <span className="nav-toggle-dot" />}
      </button>

      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}

      <aside className={"sidebar" + (open ? " open" : "")}>
        <div className="brand">
          <div className="brand-logo">Ч</div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">ChizhOS</div>
            <div className="brand-sub" title={orgName}>{orgName}</div>
          </div>
          <button className="nav-close" aria-label="Закрыть меню" onClick={() => setOpen(false)}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <nav className="nav-scroll">
          {nav.map((n) => {
            const active =
              n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={"nav-item" + (active ? " active" : "")}>
                <span className="ico">
                  <Icon name={n.icon} size={17} />
                </span>
                {n.label}
                {n.key === "notifications" && LEVELS.some((l) => counts[l.key] > 0) && (
                  <span className="nav-badges">
                    {LEVELS.filter((l) => counts[l.key] > 0).map((l) => (
                      <span key={l.key} className={"nav-badge " + l.cls} title={l.title}>
                        {counts[l.key]}
                      </span>
                    ))}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="nav-sep" />
              <Link
                href="/admin"
                className={"nav-item" + (pathname.startsWith("/admin") ? " active" : "")}
              >
                <span className="ico">
                  <Icon name="gear" size={17} />
                </span>
                Администрирование
              </Link>
            </>
          )}
        </nav>

        <div className="side-role">
          <div className="sr-ava">{initials(session.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sr-name" title={session.name}>{session.name}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              {isAdmin
                ? ROLE_LABELS.admin
                : parkName
                ? `${ROLE_LABELS[session.role]} • ${parkName}`
                : "Парк не назначен"}
            </div>
          </div>
          <button
            className="logout-btn"
            title="Выйти"
            disabled={pending}
            onClick={() => start(async () => { await logoutAction(); })}
          >
            <Icon name="logout" size={13} />
          </button>
        </div>
      </aside>
    </>
  );
}
