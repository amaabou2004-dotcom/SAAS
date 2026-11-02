import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/data/server-source";
import type { OperationType } from "@/lib/data/types";

const TYPES: OperationType[] = ["opening", "receipt", "issue", "adjustment", "inventory"];
const NEEDS_REASON: OperationType[] = ["adjustment", "inventory"];

export async function GET() {
  const { source } = await getAppContext();
  const operations = await source.getOperations(50);
  return NextResponse.json({ operations, kind: source.kind });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const type = String(body.operation_type ?? "") as OperationType;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const rawLines = Array.isArray(body.lines) ? body.lines : [];

  const errors: string[] = [];
  if (!TYPES.includes(type)) errors.push(`Type d’opération inconnu : ${type || "(vide)"}.`);
  if (NEEDS_REASON.includes(type) && reason.length < 2)
    errors.push("Un motif est obligatoire pour un ajustement ou un inventaire.");
  if (reference.length > 120) errors.push("Référence trop longue (120 caractères max).");
  if (rawLines.length === 0) errors.push("Ajoute au moins une ligne.");
  if (rawLines.length > 50) errors.push("50 lignes maximum par opération.");

  const lines: Array<{ variant_id: string; quantity_delta: number }> = [];
  for (const [index, raw] of rawLines.entries()) {
    const line = raw as { variant_id?: unknown; quantity?: unknown };
    const variantId = String(line.variant_id ?? "");
    const quantity = Number(line.quantity);
    if (!variantId) errors.push(`Ligne ${index + 1} : produit manquant.`);
    if (!Number.isFinite(quantity) || quantity === 0)
      errors.push(`Ligne ${index + 1} : quantité invalide.`);
    else if (quantity !== Math.round(quantity * 10000) / 10000)
      errors.push(`Ligne ${index + 1} : 4 décimales maximum.`);
    lines.push({ variant_id: variantId, quantity_delta: quantity });
  }

  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.variant_id)) errors.push("Un même produit ne peut pas apparaître deux fois.");
    seen.add(line.variant_id);
  }

  if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 });

  // Convention du RPC : entrées positives, sorties négatives.
  const signed = lines.map((line) => ({
    variant_id: line.variant_id,
    quantity_delta: Math.abs(line.quantity_delta) * (type === "issue" ? -1 : 1),
  }));

  const { source } = await getAppContext();
  const result = await source.postOperation({
    operation_type: type,
    reason: reason || undefined,
    reference: reference || undefined,
    lines: signed,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ operation: result.operation }, { status: 201 });
}
