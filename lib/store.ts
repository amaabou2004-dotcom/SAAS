import { computeInvoice, type InvoiceTotals } from "@/lib/money";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Invoice extends InvoiceTotals {
  id: string;
  number: string;
  client: string;
  country: string;
  amount: number;
  rateToXof: number;
  issueDate: string;
  nominalDueDate: string;
  dueDate: string;
  dueShiftReason: string | null;
  status: InvoiceStatus;
  source: "live" | "fallback";
  createdAt: string;
}

export interface NewInvoiceInput {
  client: string;
  country: string;
  amount: number;
  currency: string;
  vatRate: number;
  dueInDays: number;
  issueDate: string;
  rateToXof: number;
  nominalDueDate: string;
  dueDate: string;
  dueShiftReason: string | null;
  source: "live" | "fallback";
}

/** Store en mémoire : suffisant pour la démo, à remplacer par Supabase/Postgres. */
type Store = { invoices: Invoice[]; counter: number };

const globalStore = globalThis as unknown as { __saasStore?: Store };

function seed(): Store {
  const today = new Date().toISOString().slice(0, 10);
  const base: Array<{
    client: string;
    country: string;
    amount: number;
    currency: string;
    rate: number;
    vat: number;
    issue: string;
    due: string;
    status: InvoiceStatus;
  }> = [
    { client: "Société Niger Telecom", country: "NE", amount: 1_250_000, currency: "XOF", rate: 1, vat: 0.19, issue: "2026-10-02", due: "2026-10-17", status: "paid" },
    { client: "Sahel Logistics SARL", country: "NE", amount: 480_000, currency: "XOF", rate: 1, vat: 0.19, issue: "2026-10-12", due: "2026-10-27", status: "sent" },
    { client: "Atlas Partners (Paris)", country: "FR", amount: 3_400, currency: "EUR", rate: 655.957, vat: 0, issue: "2026-10-20", due: "2026-11-04", status: "sent" },
    { client: "AgriSahel Coopérative", country: "NE", amount: 92_500, currency: "XOF", rate: 1, vat: 0.19, issue: "2026-09-15", due: "2026-09-30", status: "overdue" },
    { client: "Kanem Digital", country: "NE", amount: 210_000, currency: "XOF", rate: 1, vat: 0.19, issue: today, due: today, status: "draft" },
  ];

  const invoices = base.map((item, index) => {
    const totals = computeInvoice({
      amount: item.amount,
      currency: item.currency,
      rateToXof: item.rate,
      vatRate: item.vat,
      dueInDays: 15,
      issueDate: item.issue,
    });
    return {
      ...totals,
      id: `inv_${index + 1}`,
      number: `FAC-2026-${String(index + 1).padStart(3, "0")}`,
      client: item.client,
      country: item.country,
      amount: item.amount,
      rateToXof: item.rate,
      issueDate: item.issue,
      nominalDueDate: item.due,
      dueDate: item.due,
      dueShiftReason: null,
      status: item.status,
      source: "fallback" as const,
      createdAt: `${item.issue}T09:00:00.000Z`,
    };
  });

  return { invoices, counter: invoices.length };
}

export function getStore(): Store {
  if (!globalStore.__saasStore) globalStore.__saasStore = seed();
  return globalStore.__saasStore;
}

export function listInvoices(): Invoice[] {
  return [...getStore().invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createInvoice(input: NewInvoiceInput): Invoice {
  const store = getStore();
  store.counter += 1;
  const totals = computeInvoice({
    amount: input.amount,
    currency: input.currency,
    rateToXof: input.rateToXof,
    vatRate: input.vatRate,
    dueInDays: input.dueInDays,
    issueDate: input.issueDate,
  });

  const invoice: Invoice = {
    ...totals,
    id: `inv_${store.counter}`,
    number: `FAC-2026-${String(store.counter).padStart(3, "0")}`,
    client: input.client,
    country: input.country,
    amount: input.amount,
    rateToXof: input.rateToXof,
    issueDate: input.issueDate,
    nominalDueDate: input.nominalDueDate,
    dueDate: input.dueDate,
    dueShiftReason: input.dueShiftReason,
    status: "sent",
    source: input.source,
    createdAt: new Date().toISOString(),
  };

  store.invoices.push(invoice);
  return invoice;
}

export function setStatus(id: string, status: InvoiceStatus): Invoice | null {
  const invoice = getStore().invoices.find((i) => i.id === id);
  if (!invoice) return null;
  invoice.status = status;
  return invoice;
}

export function resetStore(): void {
  globalStore.__saasStore = seed();
}
