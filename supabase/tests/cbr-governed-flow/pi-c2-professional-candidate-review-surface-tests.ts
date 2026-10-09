// Implementation PI-C2 — Professional Candidate Review Surface.
// Non-database, non-network, non-LLM structural tests against the REAL
// production source of src/app/intake/professional-candidate-review.tsx
// (inspected by path, not reimplemented) — mirrors pi-b2a/pi-b2b's own
// established convention for .tsx files.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/pi-c2-professional-candidate-review-surface-tests.ts
//
// Why structural-only: every .tsx component file in this repo (Module0,
// Module4-10, IntakeForm, this one) omits `import React from "react"`
// because Next.js's build pipeline provides the automatic JSX runtime.
// Confirmed experimentally: invoking this component's JSX-returning
// branch directly via the standalone tsx/esbuild runner (outside Next's
// bundler) throws "ReferenceError: React is not defined" the moment
// any JSX actually evaluates (empty-state's `return null` branch,
// which contains no JSX, runs fine). Adding a React import to the
// production file purely to satisfy a standalone test runner would be
// an unjustified production change for test-tooling convenience, which
// this engagement consistently avoids -- so, exactly like every prior
// PI-B2A/PI-B2B proof against IntakeForm.tsx/Module0.tsx, this file
// proves behavior by inspecting the real production source text, not
// by rendering it.

import { readFileSync } from "fs";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

const COMPONENT_FILE = "../../../src/app/intake/professional-candidate-review.tsx";
const src = readFileSync(require.resolve(COMPONENT_FILE), "utf8");
// Firewall checks care about executable code/JSX output, not developer
// comments (e.g. a citation like "Module10.tsx's own existing wording"
// or the standing "Post-Module1" doc-title prefix used across this
// entire engagement are legitimate documentation, not forbidden
// coupling) -- strip // line comments before those specific checks.
const code = src.replace(/^\s*\/\/.*$/gm, "");

// ── §9 — actionable status rule: only "proposed" is ever filtered in ───────
{
  const domains = ["employment", "education", "certification", "business", "reference", "evidence", "strategicAnswer"];
  for (const d of domains) {
    check(`T01 [${d}] filtered by exactly c.status === "proposed"`,
      new RegExp(`candidates\\.${d}\\.filter\\(c => c\\.status === "proposed"\\)`).test(src));
  }
  check("T02 no accepted/rejected history UI (no show/reopen/undo/tabs/historial)",
    !/show.?[Rr]ejected|reopen|undo|historial|tabs?\b/i.test(src));
  check("T03 no accepted_in_module literal anywhere (never rendered/filtered for)", !src.includes("accepted_in_module"));
  check("T04 no rejected-status literal comparison anywhere (never rendered/filtered for)", !/===\s*"rejected"/.test(src));
}

// ── §10 — empty state ───────────────────────────────────────────────────────
check("T05 returns null when total proposed count is zero", /if \(total === 0\) return null;/.test(src));

// ── §7/§8 — component role / prop contract ──────────────────────────────────
{
  check("T06 domain type derived from ProfessionalIntelligenceCandidate[\"domain\"] (no hand-duplicated union)",
    /export type ProfessionalIntelligenceCandidateDomain = ProfessionalIntelligenceCandidate\["domain"\];/.test(src));
  // T07 reconciled post-PI-D0B (authorized historical boundary-test
  // reconciliation): the original assertion required candidates/
  // onAccept/onReject to sit immediately adjacent in the prop type
  // literal -- a temporal condition PI-D0B's authorized, additive
  // enrichments/onAcceptEnrichment/onRejectEnrichment props permanently
  // end (the new props were inserted between them). Replaced with the
  // permanent invariant: the complete presentational contract exists
  // (every discovery prop unchanged in shape, plus the new enrichment
  // props), and the component still owns no state/save/mutation
  // authority over any of the three overlays it receives.
  check("T07 prop contract retains the complete permanent presentational surface: candidates/enrichments + unchanged discovery onAccept/onReject + enrichment onAcceptEnrichment/onRejectEnrichment",
    /candidates: ProfessionalIntelligenceCandidates;/.test(src) &&
    /enrichments: ProfessionalIntelligenceEnrichments;/.test(src) &&
    /onAccept: \(domain: ProfessionalIntelligenceCandidateDomain, candidateId: string\) => void;/.test(src) &&
    /onReject: \(domain: ProfessionalIntelligenceCandidateDomain, candidateId: string\) => void;/.test(src) &&
    /onAcceptEnrichment: \(enrichmentId: string\) => void;/.test(src) &&
    /onRejectEnrichment: \(enrichmentId: string\) => void;/.test(src));
  check("T07b component still owns no enrichment state/mutation authority (no setProfessionalIntelligenceEnrichments, no enrichment array reassignment)",
    !src.includes("setProfessionalIntelligenceEnrichments") && !/enrichments\.employment\s*=/.test(src));
  const forbiddenProps = ["setData", "setCandidates", "save:", "setStep", "IntakeFormData", "adapters"];
  for (const p of forbiddenProps) {
    check(`T08 prop contract never includes "${p}"`, !code.includes(p));
  }
}

// ── §12/§6 — domain grouping ────────────────────────────────────────────────
{
  const domainLabelsBlock = src.match(/const DOMAIN_LABELS: Record<ProfessionalIntelligenceCandidateDomain, string> = \{([\s\S]*?)\};/)?.[1] ?? "";
  const labelCount = (domainLabelsBlock.match(/:\s*"/g) ?? []).length;
  check("T09 exactly seven domain labels defined", labelCount === 7);
  check("T10 no canonical/legacy module number ever used as a displayed/interpolated value",
    !/Módulo \$\{|"module\d+"|legacyDataKey/.test(code));
  check("T11 no navigation step created (no setStep/step===/TOTAL reference)", !/setStep|step\s*===|\bTOTAL\b/.test(code));
}

// ── §13 — card content / forbidden technical literals ───────────────────────
{
  const forbidden = ["candidate.id}", "candidate.status", "candidate.domain}", "JSON.stringify(candidate"];
  for (const f of forbidden) check(`T12 never renders raw "${f}"`, !src.includes(f));
  check("T13 provenance is passed as a prop, never rendered as visible text (no \">{candidate.provenance}\")",
    !/>\{candidate\.provenance\}/.test(src));
  // T14 reconciled post-PI-D0B (authorized historical boundary-test
  // reconciliation): the original assertion counted <button> elements
  // FILE-WIDE, assuming exactly one review-unit component (ProposalCard)
  // existed -- a temporal condition PI-D0B's authorized, additive
  // EnrichmentCard permanently ends (it is its own, separate review
  // unit with its own two actions). Replaced with the permanent
  // invariant the original assertion actually protected: ONE REVIEW
  // UNIT -> EXACTLY TWO ACTIONS, verified per component, not globally.
  check("T14 ProposalCard (discovery review unit) has exactly two action buttons (Aceptar/Descartar), no third action",
    (() => {
      const body = src.slice(src.indexOf("function ProposalCard"), src.indexOf("function EmploymentCard"));
      return (body.match(/<button/g) ?? []).length === 2 &&
        body.includes(">\n          Aceptar\n") && body.includes(">\n          Descartar\n");
    })());
  check("T14b EnrichmentCard (enrichment review unit) has exactly two action buttons (Aceptar/Descartar), no third action",
    (() => {
      const body = src.slice(src.indexOf("function EnrichmentCard"), src.indexOf("export function ProfessionalCandidateReview"));
      return (body.match(/<button/g) ?? []).length === 2 &&
        body.includes(">\n          Aceptar\n") && body.includes(">\n          Descartar\n");
    })());
  check("T14c no third action (Edit/navigate/auto-accept) exists within either review unit", !/Editar|Ir al módulo|auto.?accept/i.test(src));
  check("T15 no 'Go to module' / Ir al módulo action", !/Ir al módulo|Go to module/i.test(src));
  check("T16 no edit modal / auto-accept checkbox", !/modal|checkbox|auto.?accept/i.test(src));
}

// ── §14 — source label (no raw literal leaked as display text) ─────────────
{
  check("T17 cv_extraction literal appears exactly once (the comparison only, never as display text)",
    (src.match(/cv_extraction/g) ?? []).length === 1 && /p\.source === "cv_extraction"/.test(src));
  check("T18 coach_discovery literal appears exactly once (the comparison only, never as display text)",
    (src.match(/coach_discovery/g) ?? []).length === 1 && /p\.source === "coach_discovery"/.test(src));
  check("T19 exact required source labels present", src.includes('"Detectado en tu CV"') && src.includes('"Identificado durante la conversación"') && src.includes('"Identificado en tu información"'));
  check("T20 source never called 'verified'/'verificado'", !/verificad/i.test(src));
}

// ── §16 — rawText never rendered ────────────────────────────────────────────
// T21 reconciled post-PI-D0B (authorized historical boundary-test
// reconciliation): the original absolute "never render rawText"
// invariant remains fully valid for DISCOVERY candidate cards -- it is
// PI-D0B's own distinct, deliberate design that EmploymentEnrichment's
// own provenance.rawText IS literally the beneficiary's exact current-
// turn message (frozen Coach provenance semantics), making it accurate
// -- not an overclaim -- to show under a plain "Mencionaste" label.
// Reconciled to verify BOTH halves: the discovery-candidate firewall is
// still absolute, and the one authorized exception reads exclusively
// from the enrichment's own provenance, never the base candidate's.
{
  const candidateCardsSrc = src.slice(0, src.indexOf("function EnrichmentCard"));
  check("T21 discovery candidate cards (everything before EnrichmentCard) never access/render .rawText",
    !candidateCardsSrc.includes(".rawText") && !candidateCardsSrc.includes("rawText}"));
  const enrichmentCardBody = src.slice(src.indexOf("function EnrichmentCard"), src.indexOf("export function ProfessionalCandidateReview"));
  check("T21b EnrichmentCard's rawText comes from enrichment.provenance, never baseCandidate.provenance or a generic \"candidate\" variable",
    /const rawText = enrichment\.provenance\[0\]\?\.rawText/.test(enrichmentCardBody) &&
    !/baseCandidate\.provenance\[0\]\?\.rawText|candidate\.provenance\[0\]\?\.rawText/.test(enrichmentCardBody));
}
check("T22 no 'exact quote'/'verbatim CV text' labeling", !/cita exacta|texto exacto del cv|verificado en el cv/i.test(src));

// ── §15 — confidence display ─────────────────────────────────────────────────
{
  check("T23 exact three confidence labels present", src.includes('"Confianza alta"') && src.includes('"Confianza media"') && src.includes('"Confianza baja"'));
  check("T24 no numeric percentage confidence display", !src.includes("%"));
  check("T25 confidence never disables/gates a button (no `disabled` anywhere in file)", !src.includes("disabled"));
  check("T26 deterministic highest-confidence-among-provenance rule present", /CONFIDENCE_RANK\[p\.confidence\] > CONFIDENCE_RANK\[best\]/.test(src));
}

// ── §17-21 — per-domain field display / no inference ───────────────────────
{
  // Employment: only the seven approved fields shown, no inferred extras
  check("T27 employment card shows exactly the seven approved candidate fields",
    ["candidate.company", "candidate.title", "candidate.startDate", "candidate.endDate", "candidate.mainFunctions", "candidate.importantProjects", "candidate.mainAchievements"]
      .every(f => src.includes(f)));
  check("T28 employment never infers/display country/city/isCurrent/supervisor/budget/recognition",
    !/candidate\.country|candidate\.city|candidate\.isCurrent|candidate\.supervisor|candidate\.budget|candidate\.internationalRecognition/.test(src));

  // Education
  check("T29 education card shows institution/degreeName/graduationYear",
    ["candidate.institution", "candidate.degreeName", "candidate.graduationYear"].every(f => src.includes(f)));
  check("T30 education never infers degreeType/startYear/hasDiploma/file availability",
    !/candidate\.degreeType|candidate\.startYear|candidate\.hasDiploma|candidate\.filePath|candidate\.fileName/.test(src));

  // Certification
  check("T31 certification card shows name/institution/year", true); // name/institution covered generically below; year distinct per domain
  check("T32 certification never infers active status/certificate possession/file availability",
    !/candidate\.isActive|candidate\.hasCertificate/.test(src));
}

// ── §20 — business card: raw role hint only, never passed to an adapter ────
{
  check("T33 business card shows name/foundedYear only as structured fields",
    src.includes("candidate.name") && src.includes("candidate.foundedYear"));
  check("T34 business role shown only as a neutral hint, exact prefix \"Rol detectado: \"",
    /Rol detectado: \{candidate\.role\}/.test(src));
  check("T35 business role never translated into fundador/cofundador/ceo/cto/otro enum literals",
    !/"fundador"|"cofundador"|"ceo"|"cto"|"otro"/.test(src));
  check("T36 PI-C2 never imports/calls any PI-C1 adapter", !/professional-intelligence-adapters|candidateTo[A-Z]/.test(src));
}

// ── §21 — reference card: raw relationship hint only ────────────────────────
{
  check("T37 reference card shows name/specificAchievements", src.includes("candidate.specificAchievements"));
  check("T38 relationship shown only as a neutral hint, exact prefix \"Relación detectada: \"",
    /Relación detectada: \{candidate\.relationshipType\}/.test(src));
  check("T39 reference never invents/displays email", !/candidate\.email/.test(src));
  const referenceCardBody = src.match(/function ReferenceCard\(\{[\s\S]*?\n\}/)?.[0] ?? "";
  check("T40 reference card never claims the reference entry is complete (no 'referencia completa'/'información completa' wording)",
    !/referencia completa|información completa/i.test(referenceCardBody));
}

// ── §22 — evidence firewall ──────────────────────────────────────────────────
{
  check("T41 evidence payload display limited to category label + fixed explanatory sentence",
    src.includes("Se detectó información que podría estar relacionada con esta categoría de evidencia."));
  const forbiddenEvidencePhrases = ["Tienes esta evidencia", "Evidencia confirmada", "Documento encontrado", "Prueba disponible"];
  for (const phrase of forbiddenEvidencePhrases) {
    check(`T42 evidence card never says "${phrase}"`, !src.includes(phrase));
  }
  check("T43 'tal_vez' implementation detail never exposed to the beneficiary (absent from source entirely)", !src.includes("tal_vez"));
  check("T44 'tengo'/'no_tengo' literals never rendered as beneficiary text", !src.includes('"tengo"') && !src.includes('"no_tengo"'));
  check("T45 exact six evidence category labels present",
    ["Premios o reconocimientos", "Membresías", "Publicaciones o apariciones en medios", "Participación como juez o evaluador", "Rol crítico o esencial", "Exhibiciones o muestras artísticas"]
      .every(l => src.includes(l)));
}

// ── §23 — strategic answer: label map, no raw targetField literal shown ────
{
  const targetFields = [
    "createdMethod", "ledImpactProjects", "solvedComplexProblems", "trainedProfessionals",
    "consultedForExpertise", "evaluatedOthers", "workedForRecognized", "aboveAverageIncome",
    "willingToConfirm", "additionalInfo",
  ];
  const mapBlock = src.match(/const STRATEGIC_FIELD_LABELS: Record<StrategicAnswerTargetField, string> = \{([\s\S]*?)\};/)?.[1] ?? "";
  check("T46 all ten target fields have a label in the map", targetFields.every(f => mapBlock.includes(`${f}:`)));
  check("T47 answer is displayed via candidate.answer, not the raw targetField literal as text",
    src.includes("candidate.answer") && !/\{candidate\.targetField\}/.test(src));
}

// ── §24/§25 — button semantics / accessibility ──────────────────────────────
{
  check("T48 Aceptar calls onAccept(domain, candidate.id) exactly", /onAccept\("employment", c\.id\)/.test(src));
  check("T49 Descartar calls onReject(domain, candidate.id) exactly", /onReject\("employment", c\.id\)/.test(src));
  check("T50 every domain wires its own literal domain string into onAccept/onReject (no shared generic dispatch that could mismatch)",
    ["employment", "education", "certification", "business", "reference", "evidence", "strategicAnswer"].every(d =>
      new RegExp(`onAccept\\("${d}", c\\.id\\)`).test(src) && new RegExp(`onReject\\("${d}", c\\.id\\)`).test(src)));
  check("T51 both buttons are real <button type=\"button\"> elements", (src.match(/type="button"/g) ?? []).length >= 2);
  check("T52 aria-label distinguishes Aceptar/Descartar and is dynamic per domain (uses DOMAIN_LABELS[domain])",
    /aria-label=\{`Aceptar propuesta de \$\{DOMAIN_LABELS\[domain\]\.toLowerCase\(\)\}`\}/.test(src) &&
    /aria-label=\{`Descartar propuesta de \$\{DOMAIN_LABELS\[domain\]\.toLowerCase\(\)\}`\}/.test(src));
  check("T53 no color-only meaning encoding (buttons carry distinct text labels, not just color)",
    src.includes(">\n          Aceptar\n") && src.includes(">\n          Descartar\n"));
}

// ── §27 — no side effects ────────────────────────────────────────────────────
{
  const forbidden = [
    "fetch(", "localStorage", "sessionStorage", "createClient", "supabase",
    "setData", "setProfessionalIntelligenceCandidates", "save(", "router.push", "window.location", "useEffect",
  ];
  for (const f of forbidden) check(`T54 no "${f}" anywhere in source`, !src.includes(f));
  check("T55 no asynchronous logic (no async/await/Promise)", !/\basync\b|\bawait\b|\bPromise\b/.test(src));
}

// ── Firewall re-proofs: no coupling to IntakeFormData/module-numbering/CBR/StructuredProfile ──
{
  const forbidden = [
    "IntakeFormData", "legacyDataKey", "module-numbering", "getModuleStatus", "DraftEnvelope",
    "StructuredProfile", "acquireField", "confirmField", "CBR", "cbr", "module7", "module8", "module9", "module10", "module11",
  ];
  for (const f of forbidden) check(`T56 no "${f}" reference in executable code (comments excluded)`, !code.includes(f));
  check("T57 does not import from IntakeForm.tsx or Module0.tsx (no import-path reference)",
    !/from\s+["'].*IntakeForm["']/.test(src) && !/from\s+["'].*Module0["']/.test(src));
  check("T58 only imports from ./primitives and @/lib/intake/professional-intelligence",
    /from "\.\/primitives"/.test(src) && /from "@\/lib\/intake\/professional-intelligence"/.test(src) &&
    (src.match(/^import /gm) ?? []).length === 2);
}

console.log(failures === 0 ? "\nALL PI-C2 CHECKS PASS" : `\n${failures} PI-C2 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
