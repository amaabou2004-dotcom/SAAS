import { NextResponse } from "next/server";
import { getCountries } from "@/lib/integrations/countries";

export const revalidate = 86_400;

export async function GET() {
  const countries = await getCountries();
  return NextResponse.json(countries);
}
