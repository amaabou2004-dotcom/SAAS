import { NextResponse } from "next/server";
import { getWeather } from "@/lib/integrations/weather";

export const revalidate = 900;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat") ?? 13.5137);
  const lon = Number(url.searchParams.get("lon") ?? 2.1098);
  const weather = await getWeather(lat, lon);
  return NextResponse.json(weather);
}
