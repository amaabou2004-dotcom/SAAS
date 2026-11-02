import { NextResponse } from "next/server";
import { listInvoices } from "@/lib/store";
import { getRate, getSeries } from "@/lib/integrations/frankfurter";
import { getHolidays } from "@/lib/integrations/nager";
import { getWeather } from "@/lib/integrations/weather";

export const revalidate = 900;

/** Un seul appel pour la page d'accueil : évite 4 requêtes côté navigateur. */
export async function GET() {
  const year = new Date().getFullYear();
  const [rate, series, holidays, weather] = await Promise.all([
    getRate("EUR", "XOF"),
    getSeries("EUR", "XOF", 30),
    getHolidays(year, "NE"),
    getWeather(),
  ]);

  const invoices = listInvoices();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = holidays.data.filter((h) => h.date >= today).slice(0, 4);

  return NextResponse.json({
    rate,
    series,
    holidays: { ...holidays, data: upcoming },
    weather,
    invoices,
    kpis: {
      count: invoices.length,
      billed: invoices.reduce((s, i) => s + i.ttcXof, 0),
      paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.ttcXof, 0),
      overdue: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.ttcXof, 0),
      pending: invoices.filter((i) => i.status === "sent").reduce((s, i) => s + i.ttcXof, 0),
    },
  });
}
