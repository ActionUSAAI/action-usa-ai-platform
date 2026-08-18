import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Legal Decision Cycle / Legal Decision Procedure ──────────────────────────
//
// Materializa dos contratos normativos, distintos y ya congelados:
//
// Legal Decision Cycle Policy Contract v1: autoriza si y solo si
// Case.initial_legal_petition IS NOT NULL AND Case.active_legal_petition
// IS NOT NULL. Independiente de quién invoca.
//
// Legal Decision Procedure Contract v1: una vez autorizado, ejecuta una
// evaluación jurídica; solo si tiene éxito, ejecuta sobre ella una
// estrategia jurídica. Nunca vuelve a verificar autorización. Nunca
// modifica Initial/Active Legal Petition. Nunca modifica artefactos
// previos directamente (solo pueden perder vigencia por aparición de un
// sibling nuevo, conforme ADR-010).
//
// Esta implementación materializa la evaluación mediante A1 y la
// estrategia mediante A5. El diseño del Procedure permanece independiente
// de esos agentes; únicamente esta implementación concreta utiliza dichos
// componentes.
//
// Fuera de alcance de este componente: no reemplaza el disparo
// fire-and-forget de A5 que ya hace a1-intake-analyzer/route.ts vía
// waitUntil() — ese mecanismo permanece intacto y sin relación con este
// Procedure. No hay ningún flujo de UI conectado a esta ruta todavía;
// tampoco implementa el mecanismo de confirmación de Initial/Active Legal
// Petition (Fase 5).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const db = adminDb();

  let body: { case_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { case_id } = body;
  if (!case_id) {
    return NextResponse.json({ error: "Missing required field: case_id" }, { status: 400 });
  }

  // ── Policy: verificación de autorización ────────────────────────────────
  // Consulta directa a Case.initial_legal_petition / Case.active_legal_petition.
  // Si cualquiera es NULL, el Procedure no se ejecuta — ni A1 ni A5 son
  // invocados. Esta verificación ocurre una sola vez, aquí; el Procedure
  // que sigue nunca la repite.
  const { data: caseRow, error: caseErr } = await db
    .from("cases")
    .select("id, initial_legal_petition, active_legal_petition")
    .eq("id", case_id)
    .maybeSingle();

  if (caseErr) {
    return NextResponse.json({ error: `Error fetching case: ${caseErr.message}` }, { status: 500 });
  }
  if (!caseRow) {
    return NextResponse.json({ authorized: false, reason: "Case not found." });
  }
  if (!caseRow.initial_legal_petition || !caseRow.active_legal_petition) {
    return NextResponse.json({
      authorized: false,
      reason: "Case is missing initial_legal_petition and/or active_legal_petition. The Legal Decision Cycle Policy Contract v1 requires both to be set before any Procedure may run.",
    });
  }

  // ── Procedure: Secuencia Canónica ───────────────────────────────────────
  // Autorizado. A partir de aquí, la autorización nunca se vuelve a
  // verificar. Paso 1: evaluación jurídica (A1), síncrona.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://actionusaai.com";

  let a1Result: { success: true; analysis: Record<string, unknown> } | { error: string };
  try {
    const a1Res = await fetch(`${baseUrl}/api/agents/a1-intake-analyzer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id }),
    });
    a1Result = await a1Res.json();
    if (!a1Res.ok || "error" in a1Result) {
      const reason = "error" in a1Result ? a1Result.error : `A1 returned status ${a1Res.status}`;
      return NextResponse.json({ authorized: true, error: reason });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ authorized: true, error: `A1 invocation threw: ${msg}` });
  }

  const analysis = a1Result.analysis;

  // Paso 2: estrategia jurídica (A5), solo porque A1 tuvo éxito. Mismo
  // contrato de entrada que A5 ya expone hoy — sin cambios en A5.
  let a5Result: { success: true; strategy: Record<string, unknown> } | { error: string };
  try {
    const a5Res = await fetch(`${baseUrl}/api/agents/a5-case-strategy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        case_id,
        submission_id: analysis.submission_id,
        criteria_met: analysis.criteria_met,
        criteria_scores: analysis.criteria_scores,
        criterion_assessment_id: analysis.id,
      }),
    });
    a5Result = await a5Res.json();
    if (!a5Res.ok || "error" in a5Result) {
      const reason = "error" in a5Result ? a5Result.error : `A5 returned status ${a5Res.status}`;
      return NextResponse.json({ authorized: true, criterion_assessment: analysis, error: reason });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ authorized: true, criterion_assessment: analysis, error: `A5 invocation threw: ${msg}` });
  }

  return NextResponse.json({
    authorized: true,
    criterion_assessment: analysis,
    blueprint: a5Result.strategy,
  });
}
