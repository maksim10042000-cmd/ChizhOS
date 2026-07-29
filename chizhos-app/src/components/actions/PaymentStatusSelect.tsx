"use client";

import { useTransition } from "react";
import { setPaymentStatusAction } from "@/lib/actions";

export default function PaymentStatusSelect({
  paymentId,
  paid,
}: {
  paymentId: string;
  paid: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      className={"status-select " + (paid ? "ok" : "bad")}
      value={paid ? "paid" : "overdue"}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await setPaymentStatusAction(paymentId, e.target.value === "paid");
        })
      }
    >
      <option value="paid">Оплачено</option>
      <option value="overdue">Не оплачено</option>
    </select>
  );
}
