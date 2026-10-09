// Implementation PI-B2B — Route + Module0 Orchestration.
// Non-database, non-network, non-LLM unit tests against the REAL
// production source of src/app/api/intake/a0-extract/route.ts,
// src/app/intake/modules/Module0.tsx, and src/app/intake/IntakeForm.tsx
// (inspected by path, not reimplemented) — mirrors pi-a/pi-b1/pi-b2a's
// own established convention. No live fetch/LLM/DB/Storage access.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-b2b-professional-candidate-runtime-wiring-tests.ts

import { readFileSync } from "fs";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const ROUTE_FILE = "../../../src/app/api/intake/a0-extract/route.ts";
const MODULE0_FILE = "../../../src/app/intake/modules/Module0.tsx";
const INTAKEFORM_FILE = "../../../src/app/intake/IntakeForm.tsx";
const routeSrc = readFileSync(require.resolve(ROUTE_FILE), "utf8");
const module0Src = readFileSync(require.resolve(MODULE0_FILE), "utf8");
const intakeFormSrc = readFileSync(require.resolve(INTAKEFORM_FILE), "utf8");

// ── §66 — route.ts: orchestration shape ─────────────────────────────────────
{
  check("T01 route imports extractProfessionalCandidates alongside extractCvFields (one import line)",
    /import \{ extractCvFields, extractProfessionalCandidates \} from "@\/lib\/intake\/a0-extract";/.test(routeSrc));
  check("T02 route uses Promise.allSettled, not Promise.all, over exactly these two calls",
    /Promise\.allSettled\(\[\s*extractCvFields\(base64, mimeType, ANTHROPIC_KEY\),\s*extractProfessionalCandidates\(base64, mimeType, ANTHROPIC_KEY\),\s*\]\)/.test(routeSrc));
  check("T03 route never calls Promise.all(", !/Promise\.all\(/.test(routeSrc));
  check("T04 exactly one Promise.allSettled call site", (routeSrc.match(/Promise\.allSettled\(/g) ?? []).length === 1);
  check("T05 exactly one call site each to extractCvFields and extractProfessionalCandidates",
    (routeSrc.match(/extractCvFields\(/g) ?? []).length === 1 &&
    (routeSrc.match(/extractProfessionalCandidates\(/g) ?? []).length === 1);
}

// ── §67 — four-branch response matrix ───────────────────────────────────────
{
  check("T06 fields-rejected branch returns the exact pre-existing 502 shape",
    /if \(fieldsResult\.status === "rejected"\) \{\s*const extractErr = fieldsResult\.reason;\s*const msg = extractErr instanceof Error \? extractErr\.message : "A0 extraction failed";\s*return NextResponse\.json\(\{ error: msg, extractionFailed: true \}, \{ status: 502 \}\);\s*\}/.test(routeSrc));
  check("T07 fields-fulfilled + professional-fulfilled branch returns BOTH fields and professionalCandidates",
    /if \(professionalResult\.status === "fulfilled"\) \{\s*return NextResponse\.json\(\{ fields: fieldsResult\.value, professionalCandidates: professionalResult\.value \}\);\s*\}/.test(routeSrc));
  check("T08 fields-fulfilled + professional-rejected branch returns ONLY fields (professionalCandidates key entirely omitted, not null/empty)",
    /return NextResponse\.json\(\{ fields: fieldsResult\.value \}\);/.test(routeSrc) &&
    !/professionalCandidates: null/.test(routeSrc) &&
    !/professionalCandidates: \[\]/.test(routeSrc) &&
    !/professionalCandidates: emptyProfessionalIntelligenceCandidates/.test(routeSrc));
  check("T09 both-rejected falls through the SAME fields-rejected 502 branch (no separate both-failure path exists)",
    (routeSrc.match(/status: 502/g) ?? []).length === 1);
  check("T10 outer catch/500 handler is byte-identical to the pre-existing shape",
    /catch \(e\) \{\s*const msg = e instanceof Error \? e\.message : "Error desconocido";\s*return NextResponse\.json\(\{ error: msg, extractionFailed: true \}, \{ status: 500 \}\);\s*\}/.test(routeSrc));
}

// ── §68 — route.ts: zero change outside the orchestration block ────────────
{
  check("T11 invitation lookup (status/expiry gate) is unchanged",
    /\.in\("status", \["pending", "opened"\]\)\s*\.gt\("expires_at", now\)/.test(routeSrc));
  check("T12 isCvPathAuthorizedForInvitation fail-closed path-ownership check is unchanged",
    /if \(!isCvPathAuthorizedForInvitation\(filePath, invitation\.id as string\)\) \{\s*return NextResponse\.json\(\{ error: "El archivo solicitado no pertenece a esta invitación\." \}, \{ status: 403 \}\);\s*\}/.test(routeSrc));
  check("T13 Storage download + base64/mimeType derivation is unchanged",
    /const \{ data: blob, error: downloadError \} = await db\.storage\.from\(BUCKET\)\.download\(filePath\);/.test(routeSrc) &&
    /const base64 = Buffer\.from\(arrayBuffer\)\.toString\("base64"\);/.test(routeSrc));
  check("T14 no second API route file was created for professional extraction",
    !/\/api\/intake\/a0-extract-professional/.test(routeSrc));
}

// ── §69 — Module0.tsx: one fetch per runA0, no second orchestration fn ──────
{
  check("T15 Module0 has no runProfessionalExtraction function (frozen PI-B2 MR correction)",
    !/function runProfessionalExtraction/.test(module0Src));
  check("T16 Module0 still issues exactly the three pre-existing fetches (a0-extract, upload, coach) — no new request added",
    (module0Src.match(/fetch\(/g) ?? []).length === 3 &&
    (module0Src.match(/fetch\("\/api\/intake\/a0-extract"/g) ?? []).length === 1);
  check("T17 Module0 gained exactly one new prop: onProfessionalCandidatesExtracted",
    /onProfessionalCandidatesExtracted: \(candidates: ProfessionalIntelligenceCandidates\) => void;/.test(module0Src));
  check("T18 Module0 imports ProfessionalIntelligenceCandidates as a type-only import",
    /import type \{ ProfessionalIntelligenceCandidates \} from "@\/lib\/intake\/professional-intelligence";/.test(module0Src));
}

// ── §70 — Module0.tsx: callback invocation conditions + ordering ────────────
{
  const runA0Body = module0Src.slice(module0Src.indexOf("async function runA0"), module0Src.indexOf("async function handleUpload"));
  check("T19 onProfessionalCandidatesExtracted is called only inside an `if (json.professionalCandidates)` guard",
    /if \(json\.professionalCandidates\) \{\s*onProfessionalCandidatesExtracted\(json\.professionalCandidates as ProfessionalIntelligenceCandidates\);\s*\}/.test(runA0Body));
  check("T20 the guard/callback is positioned AFTER the existing onCheckpoint call within runA0 (ordering preserved)",
    runA0Body.indexOf("onCheckpoint({ ...data, structuredProfile: profile });") <
    runA0Body.indexOf("onProfessionalCandidatesExtracted(json.professionalCandidates"));
  check("T21 the callback is not invoked in the catch branch (extraction failure never fires it)",
    !/catch \{[\s\S]*onProfessionalCandidatesExtracted/.test(runA0Body));
}

// ── §71 — Module0.tsx: no new UI/state/loading/error surface ────────────────
{
  check("T22 no new useState calls were added (still exactly 5: extracting, uploadError, chatInput, sending, reopenedFields)",
    (module0Src.match(/= useState/g) ?? []).length === 5);
  check("T23 no candidate-related JSX/UI text was added (JSX return block has zero 'andidate' occurrences)",
    !/andidate/.test(module0Src.slice(module0Src.indexOf("return (\n    <div"))));
}

// ── §72 — IntakeForm.tsx: replacement callback shape ─────────────────────────
{
  check("T24 IntakeForm imports replaceCvExtractionCandidates alongside the existing PI-B2A imports",
    /type ProfessionalIntelligenceCandidates,\s*emptyProfessionalIntelligenceCandidates,\s*replaceCvExtractionCandidates,/.test(intakeFormSrc));
  const handlerMatch = intakeFormSrc.match(/const handleProfessionalCandidatesExtracted = useCallback\(\(incoming: ProfessionalIntelligenceCandidates\) => \{[\s\S]*?\}, \[\]\);/);
  check("T25 handleProfessionalCandidatesExtracted exists with empty dependency array", !!handlerMatch);
  const handlerBody = handlerMatch?.[0] ?? "";
  // T26 reconciled post-PI-D0B (authorized historical boundary-test
  // reconciliation): the original assertion required an exact
  // TWO-argument call -- a temporal condition PI-D0B's authorized
  // protected-candidate-ID extension permanently ends (a beneficiary-
  // accepted Employment enrichment must protect its exact base
  // candidate from CV replacement). Replaced with the permanent
  // invariant: the REAL helper is still called (never a comparator
  // reimplemented inline), over the current candidate overlay and the
  // incoming CV overlay, now with an explicit third argument.
  check("T26 handler uses the REAL replaceCvExtractionCandidates helper over the current overlay + incoming, now with a protected-ID third argument (never *SameIdentity/*MaterialEquals, never reimplemented inline)",
    /replaceCvExtractionCandidates\(professionalIntelligenceCandidatesRef\.current, incoming, protectedCandidateIds\)/.test(handlerBody) &&
    !/SameIdentity/.test(handlerBody) && !/MaterialEquals/.test(handlerBody));
  check("T26b protectedCandidateIds is derived ONLY from status === \"accepted\" Employment enrichments (proposed/rejected never protect)",
    /\.filter\(e => e\.status === "accepted" && e\.target\.domain === "employment"\)/.test(handlerBody) &&
    !/status === "proposed"[\s\S]{0,80}protectedCandidateIds|status === "rejected"[\s\S]{0,80}protectedCandidateIds/.test(handlerBody));
  // T27 reconciled post-PI-D0B: the original assertion hard-coded the
  // variable name `next` -- a naming detail, not the actual invariant.
  // The permanent invariant (ref assigned synchronously alongside the
  // state setter, for the SAME candidate overlay result) is unchanged
  // and still verified here, under the current variable name.
  check("T27 handler synchronously updates BOTH the candidate ref and the candidate state setter with the SAME replacement result",
    /professionalIntelligenceCandidatesRef\.current = nextCandidates;/.test(handlerBody) &&
    /setProfessionalIntelligenceCandidates\(nextCandidates\);/.test(handlerBody));
  check("T28 handler never calls save() or localStorage.setItem (persistence rides existing checkpoint/autosave/manual-save)",
    !/save\(/.test(handlerBody) && !/localStorage\.setItem/.test(handlerBody));
}

// ── §73 — IntakeForm.tsx: single wiring point, zero collateral change ──────
{
  // T29 reconciled (PI-D1D-R1): the OLD exact-string literal is stale by
  // design -- D1D additively extends this same render line with
  // onCoachTurnCheckpoint/professionalContext/boundedEmploymentContexts.
  // Replaced with structural assertions proving the permanent B2B
  // boundary survives: exactly one Module0 render, gated at step 0,
  // still carrying onProfessionalCandidatesExtracted (the A0 callback
  // this gate itself wired), with the D1D additions coexisting rather
  // than replacing anything.
  const module0RenderLines = intakeFormSrc.match(/\{step === 0\s+&& <Module0\s[\s\S]*?\/>\}/g) ?? [];
  check("T29a exactly one Module0 render line", module0RenderLines.length === 1);
  const module0Render = module0RenderLines[0] ?? "";
  check("T29b Module0 render gated at step === 0", module0Render.startsWith("{step === 0"));
  check("T29c onProfessionalCandidatesExtracted (A0 professional Candidate callback, B2B) still wired", module0Render.includes("onProfessionalCandidatesExtracted={handleProfessionalCandidatesExtracted}"));
  check("T29d D1D additive props coexist without displacing the B2B wiring", module0Render.includes("onCoachTurnCheckpoint={onCoachTurnCheckpoint}") && module0Render.includes("boundedEmploymentContexts={boundedEmploymentContexts}"));
  check("T29e no second A0 fetch call introduced in IntakeForm.tsx (the one A0 request remains exclusively Module0's own runA0, unchanged)", !intakeFormSrc.includes("/api/intake/a0-extract"));
  check("T30 handleProfessionalCandidatesExtracted is referenced exactly twice (definition + the one Module0 wiring site)",
    (intakeFormSrc.match(/handleProfessionalCandidatesExtracted/g) ?? []).length === 2);
  check("T31 replaceCvExtractionCandidates is called exactly once in IntakeForm.tsx (no duplicate/alternate call site)",
    (intakeFormSrc.match(/replaceCvExtractionCandidates\(/g) ?? []).length === 1);
}

// ── §74 — firewall re-proofs (submit/hydration/save untouched by PI-B2B) ────
{
  const submitMatch = intakeFormSrc.match(/function submit\([\s\S]*?\n  \}/);
  check("T32 submit() exists and has zero reference to professionalIntelligenceCandidates (re-proof, PI-B2B added no new reference)",
    !!submitMatch && !/professionalIntelligenceCandidates/.test(submitMatch[0]));
  check("T33 parseDraftEnvelope / isValidProfessionalIntelligenceCandidatesOverlay are unmodified by PI-B2B (no second definition, no PI-B2B-only branch added)",
    (intakeFormSrc.match(/function parseDraftEnvelope/g) ?? []).length === 1 &&
    (intakeFormSrc.match(/function isValidProfessionalIntelligenceCandidatesOverlay/g) ?? []).length === 1);
  check("T34 the hydration effect still sets the candidates ref/state exactly once each (no PI-B2B-added second hydration path)",
    (intakeFormSrc.match(/professionalIntelligenceCandidatesRef\.current = hydratedCandidates;/g) ?? []).length === 1 &&
    (intakeFormSrc.match(/setProfessionalIntelligenceCandidates\(hydratedCandidates\);/g) ?? []).length === 1);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
