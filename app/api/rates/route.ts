import { NextResponse } from "next/server";
import { getRate, getSeries } from "@/lib/integrations/frankfurter";

export const revalidate = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = (url.searchParams.get("base") ?? "EUR").toUpperCase();
  const quote = (url.searchParams.get("quote") ?? "XOF").toUpperCase();
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 7), 365);

  const [rate, series] = await Promise.all([
    getRate(base, quote),
    getSeries(base, quote, days),
  ]);

  return NextResponse.json({
    rate,
    series,
    pair: `${base}/${quote}`,
  });
}
