import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Legal Identity — Case.initial_legal_petition / Case.active_legal_petition ──
//
// Este endpoint materializa la Acción 1 (cambiar la petición jurídica del
// caso) — NUNCA la Acción 2 (ejecutar un Legal Decision Cycle). Nunca
// invoca /api/agents/legal-decision-cycle ni ningún agente. Solo escribe
// en Case.
//
// initial_legal_petition es un atributo inmutable de dominio. Una vez
// establecido, cualquier intento posterior de modificarlo constituye una
// violación del contrato de dominio y debe ser rechazado explícitamente
// (409 Conflict) — nunca ignorado silenciosamente. El backend es la
// autoridad de esta regla, independientemente de lo que la UI permita o
// prevenga.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(request: NextRequest) {
  const db = adminDb();

  let body: {
    case_id: string;
    initial_legal_petition?: string;
    active_legal_petition?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { case_id, initial_legal_petition, active_legal_petition } = body;
  if (!case_id) {
    return NextResponse.json({ error: "Missing required field: case_id" }, { status: 400 });
  }
  if (initial_legal_petition === undefined && active_legal_petition === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: caseRow, error: caseErr } = await db
    .from("cases")
    .select("initial_legal_petition, active_legal_petition")
    .eq("id", case_id)
    .maybeSingle();
  if (caseErr) {
    return NextResponse.json({ error: `Error fetching case: ${caseErr.message}` }, { status: 500 });
  }
  if (!caseRow) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  // Regla de inmutabilidad: si initial_legal_petition ya existe, cualquier
  // intento de cambiarlo a un valor distinto se rechaza explícitamente —
  // nunca se ignora en silencio.
  if (
    initial_legal_petition !== undefined &&
    caseRow.initial_legal_petition !== null &&
    caseRow.initial_legal_petition !== initial_legal_petition
  ) {
    return NextResponse.json(
      {
        error: "INITIAL_LEGAL_PETITION_IMMUTABLE",
        message: "Initial Legal Petition cannot be modified once it has been confirmed.",
      },
      { status: 409 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (initial_legal_petition !== undefined) patch.initial_legal_petition = initial_legal_petition;
  if (active_legal_petition !== undefined) patch.active_legal_petition = active_legal_petition;

  const { data: updated, error: updateErr } = await db
    .from("cases")
    .update(patch)
    .eq("id", case_id)
    .select("id, initial_legal_petition, active_legal_petition")
    .single();
  if (updateErr || !updated) {
    return NextResponse.json({ error: `Failed to update case: ${updateErr?.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, case: updated });
}
