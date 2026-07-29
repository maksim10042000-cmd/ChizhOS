"use client";

import { useTransition } from "react";
import { toggleStatusAction } from "@/lib/actions";
import type { CarStatus } from "@/lib/types";

export default function StatusToggle({ carId, status }: { carId: string; status: CarStatus }) {
  const [pending, start] = useTransition();
  return (
    <button
      className={"st st-btn " + (status === "on" ? "on" : "idle")}
      disabled={pending}
      title="Переключить статус"
      onClick={() => start(async () => { await toggleStatusAction(carId); })}
    >
      <span className="d2" />
      {pending ? "…" : status === "on" ? "На линии" : "В простое"}
    </button>
  );
}
