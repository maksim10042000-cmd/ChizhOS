"use client";

import { useTransition } from "react";
import { markPaidAction } from "@/lib/actions";

export default function PayButton({
  carId,
  overdue,
  label = "Оплачено",
}: {
  carId: string;
  overdue: number;
  label?: string;
}) {
  const [pending, start] = useTransition();
  if (overdue <= 0) return <span className="pill g">Оплачено</span>;
  return (
    <button
      className="btn"
      style={{ padding: "6px 12px" }}
      disabled={pending}
      onClick={() => start(async () => { await markPaidAction(carId); })}
    >
      {pending ? "…" : label}
    </button>
  );
}
