"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACTIONS: Array<{ status: "draft" | "sent" | "paid" | "overdue"; label: string }> = [
  { status: "sent", label: "Marquer envoyée" },
  { status: "paid", label: "Marquer payée" },
  { status: "overdue", label: "Marquer en retard" },
  { status: "draft", label: "Brouillon" },
];

export function StatusActions({
  id,
  status,
}: {
  id: string;
  status: "draft" | "sent" | "paid" | "overdue";
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function update(next: typeof status) {
    setPending(next);
    await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    setPending(null);
    router.refresh();
  }

  return (
    <div className="row">
      {ACTIONS.filter((a) => a.status !== status).map((action) => (
        <button
          key={action.status}
          onClick={() => update(action.status)}
          disabled={pending !== null}
          className={action.status === "paid" ? "primary" : ""}
        >
          {pending === action.status ? "…" : action.label}
        </button>
      ))}
    </div>
  );
}
