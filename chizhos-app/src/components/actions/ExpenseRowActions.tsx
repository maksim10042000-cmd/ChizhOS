"use client";

import { useTransition } from "react";
import Icon from "@/components/Icon";
import { deleteExpenseAction } from "@/lib/actions";

export default function ExpenseRowActions({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="icon-btn del"
      title="Удалить расход"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Удалить расход «${name}»? Действие нельзя отменить.`)) {
          start(async () => { await deleteExpenseAction(id); });
        }
      }}
    >
      <Icon name="x" size={14} />
    </button>
  );
}
