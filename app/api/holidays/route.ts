import { NextResponse } from "next/server";
import { getDeadline, getHolidays } from "@/lib/integrations/nager";
import { addDays } from "@/lib/money";

export const revalidate = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = (url.searchParams.get("country") ?? "NE").toUpperCase();
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const issueDate = url.searchParams.get("issueDate");
  const dueInDays = Number(url.searchParams.get("dueInDays") ?? 15);

  if (issueDate) {
    const result = await getDeadline(issueDate, dueInDays, country);
    return NextResponse.json(result);
  }

  const holidays = await getHolidays(year, country);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = holidays.data.filter((h) => h.date >= today).slice(0, 5);
  const next = upcoming[0]?.date ?? null;

  return NextResponse.json({
    country,
    year,
    holidays,
    upcoming,
    daysUntilNext: next ? Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000) : null,
    sample: addDays(today, 10),
  });
}
