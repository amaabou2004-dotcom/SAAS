import { NextResponse } from "next/server";
import { createInvoice, listInvoices, type InvoiceStatus } from "@/lib/store";
import { getRate } from "@/lib/integrations/frankfurter";
import { getDeadline } from "@/lib/integrations/nager";
import { VAT_RATES } from "@/lib/money";

const CURRENCIES = new Set(["XOF", "EUR", "USD", "GBP", "CAD", "CNY"]);
const COUNTRIES = new Set(["NE", "SN", "CI", "ML", "BF", "BJ", "TG", "GW", "FR", "NG", "GH", "US"]);

export async function GET() {
  const invoices = listInvoices();
  const totals = invoices.reduce(
    (acc, inv) => {
      acc.ttc += inv.ttcXof;
      if (inv.status === "paid") acc.paid += inv.ttcXof;
      if (inv.status === "overdue") acc.overdue += inv.ttcXof;
      if (inv.status === "sent") acc.pending += inv.ttcXof;
      return acc;
    },
    { ttc: 0, paid: 0, overdue: 0, pending: 0 },
  );
  return NextResponse.json({ invoices, totals });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const client = typeof body.client === "string" ? body.client.trim() : "";
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "XOF").toUpperCase();
  const country = String(body.country ?? "NE").toUpperCase();
  const dueInDays = Number(body.dueInDays ?? 15);
  const issueDate =
    typeof body.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.issueDate)
      ? body.issueDate
      : new Date().toISOString().slice(0, 10);
  const vatRate =
    typeof body.vatRate === "number" ? body.vatRate : (VAT_RATES[country] ?? 0.19);

  const errors: string[] = [];
  if (client.length < 2) errors.push("Le nom du client est requis (2 caractères min).");
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Le montant doit être supérieur à 0.");
  if (!CURRENCIES.has(currency)) errors.push(`Devise non supportée : ${currency}.`);
  if (!COUNTRIES.has(country)) errors.push(`Pays non supporté : ${country}.`);
  if (!Number.isInteger(dueInDays) || dueInDays < 1 || dueInDays > 180)
    errors.push("L'échéance doit être entre 1 et 180 jours.");
  if (vatRate < 0 || vatRate > 0.5) errors.push("Taux de TVA invalide.");

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  // Taux réel (ou parité de secours) + échéance reportée au jour ouvré suivant.
  const [rate, deadline] = await Promise.all([
    currency === "XOF" ? Promise.resolve(null) : getRate(currency, "XOF"),
    getDeadline(issueDate, dueInDays, country),
  ]);

  const rateToXof = currency === "XOF" ? 1 : (rate?.data.rate ?? 1);
  const source = currency === "XOF" ? deadline.holidays.source : (rate?.source ?? "fallback");

  const invoice = createInvoice({
    client,
    country,
    amount,
    currency,
    vatRate,
    dueInDays,
    issueDate,
    rateToXof,
    nominalDueDate: deadline.deadline.nominalDueDate,
    dueDate: deadline.deadline.dueDate,
    dueShiftReason: deadline.deadline.reason,
    source,
  });

  return NextResponse.json({ invoice }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    status?: InvoiceStatus;
  };
  const allowed: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];
  if (!body.id || !body.status || !allowed.includes(body.status)) {
    return NextResponse.json({ error: "id et status requis" }, { status: 422 });
  }
  const { setStatus } = await import("@/lib/store");
  const invoice = setStatus(body.id, body.status);
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  return NextResponse.json({ invoice });
}
