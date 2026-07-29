"use client";

import { useTransition } from "react";
import Icon from "@/components/Icon";
import { dismissNotifAction, clearNotifsAction } from "@/lib/actions";

export function DismissButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="notif-x"
      title="Удалить уведомление"
      disabled={pending}
      onClick={() => start(async () => { await dismissNotifAction(id); })}
    >
      <Icon name="x" size={15} />
    </button>
  );
}

export function ClearAllButton({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  if (ids.length === 0) return null;
  return (
    <button
      className="btn ghost"
      style={{ padding: "7px 14px" }}
      disabled={pending}
      onClick={() => {
        if (window.confirm("Очистить все уведомления? Действие нельзя отменить.")) {
          start(async () => { await clearNotifsAction(ids); });
        }
      }}
    >
      {pending ? "…" : "Очистить всё"}
    </button>
  );
}
