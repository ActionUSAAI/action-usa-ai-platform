// A0 CV METADATA STALE-CLOSURE — Minimal Correction Implementation
// (Exact Design + R1 Fresh-State Authority + R2 Authoritative State Getter
// & Helper Dependency, all approved). Non-database, non-network unit tests
// against the REAL production exports of src/lib/intake/a0-checkpoint.ts
// (imported by path, not reimplemented) -- mirrors a2-a0-extraction-
// expansion-tests.ts's own convention. buildA0StructuredProfileCheckpoint
// and composeA0Checkpoint are pure, React-free functions; acquireField is
// imported and exercised for real, never reimplemented.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/a0-checkpoint-authority-tests.ts
//
// Scope: the A0-completion checkpoint composition seam only (the stale-
// closure fix). Does NOT assert anything about handleUpload's own
// separate, unfixed stale-closure risk, or sendCoachMessage's own
// separate, unfixed stale-closure risk -- both remain explicitly out of
// scope per the frozen design (HANDLEUPLOAD_SEPARATE_DEFECT_FIXED:NO,
// COACH_STALE_PRODUCER_FIXED:NO).

import { buildA0StructuredProfileCheckpoint, composeA0Checkpoint } from "../../../src/lib/intake/a0-checkpoint";
import { acquireField, confirmField, emptyStructuredProfile, emptyField } from "../../../src/lib/intake/structured-profile";
import type { Module0 } from "../../../src/app/intake/types";
import * as fs from "fs";
import * as path from "path";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); }
  else { failures++; console.error(`FAIL  ${label}`); }
}

function makeModule0(overrides: Partial<Module0> = {}): Module0 {
  return {
    cvFilePath: "",
    cvFileName: "",
    cvSource: "",
    coachAcknowledged: false,
    structuredProfile: emptyStructuredProfile(),
    coachConversation: [],
    ...overrides,
  };
}

// ── T01 — CV metadata preserved ─────────────────────────────────────────
{
  const latest = makeModule0({ cvFilePath: "module0/cv/x.pdf", cvFileName: "x.pdf", cvSource: "existing" });
  const result = buildA0StructuredProfileCheckpoint(latest, {});
  check("T01 cvFilePath preserved exactly", result.cvFilePath === "module0/cv/x.pdf");
  check("T01 cvFileName preserved exactly", result.cvFileName === "x.pdf");
  check("T01 cvSource preserved exactly", result.cvSource === "existing");
}

// ── T02 — StructuredProfile acquisition ─────────────────────────────────
{
  const latest = makeModule0();
  const result = buildA0StructuredProfileCheckpoint(latest, { profession: { value: "Ingeniero", confidence: "high" } });
  const expected = acquireField(emptyField(), { value: "Ingeniero", source: "cv_extraction", confidence: "high" });
  check("T02 extracted field acquired via real acquireField", JSON.stringify(result.structuredProfile.profession) === JSON.stringify(expected));
}

// ── T03 — Existing StructuredProfile semantics (beneficiary-confirmed protected) ──
{
  const confirmed = confirmField(acquireField(emptyField(), { value: "España", source: "cv_extraction", confidence: "high" }), "beneficiary-123");
  const latest = makeModule0({ structuredProfile: { ...emptyStructuredProfile(), countryOfResidence: confirmed } });
  const result = buildA0StructuredProfileCheckpoint(latest, { countryOfResidence: { value: "Francia", confidence: "medium" } });
  check("T03 beneficiary-confirmed field marked conflicting, not silently overwritten",
    result.structuredProfile.countryOfResidence.status === "conflicting" && result.structuredProfile.countryOfResidence.value === "España");
}

// ── T04 — Unrelated concurrent Module0 state preserved ──────────────────
{
  const latest = makeModule0({ coachAcknowledged: true, cvFileName: "newer.pdf" });
  const result = buildA0StructuredProfileCheckpoint(latest, {});
  check("T04 unrelated latest state (coachAcknowledged/cvFileName) preserved, not reverted",
    result.coachAcknowledged === true && result.cvFileName === "newer.pdf");
}

// ── T05 — Coach conversation preserved exactly (same reference) ────────
{
  const conversation = [{ role: "user" as const, content: "hola", at: "2026-01-01T00:00:00.000Z" }];
  const latest = makeModule0({ coachConversation: conversation });
  const result = buildA0StructuredProfileCheckpoint(latest, {});
  check("T05 coachConversation preserved by reference, same length", result.coachConversation === conversation && result.coachConversation.length === 1);
}

// ── T06 — coachAcknowledged preserved ───────────────────────────────────
{
  const latest = makeModule0({ coachAcknowledged: true });
  const result = buildA0StructuredProfileCheckpoint(latest, {});
  check("T06 coachAcknowledged true preserved", result.coachAcknowledged === true);
}

// ── T07 — Professional Candidate isolation (no such field exists on input/output) ──
{
  const latest = makeModule0();
  const result = buildA0StructuredProfileCheckpoint(latest, {});
  check("T07 result has no professionalCandidates field", !("professionalCandidates" in (result as unknown as Record<string, unknown>)));
  check("T07 result shape is exactly the 6 Module0 fields", Object.keys(result).sort().join(",") === "coachAcknowledged,coachConversation,cvFileName,cvFilePath,cvSource,structuredProfile");
}

// ── T08 — One checkpoint-shaped result, no side effect ──────────────────
{
  const latest = makeModule0();
  const result = buildA0StructuredProfileCheckpoint(latest, { email: { value: "a@b.com", confidence: "high" } });
  check("T08 result is a single coherent full Module0 object", typeof result === "object" && result !== null && "structuredProfile" in result);
}

// ── T09 — CV optional: empty metadata valid and remains empty ──────────
{
  const latest = makeModule0();
  const result = buildA0StructuredProfileCheckpoint(latest, { profession: { value: "Médico", confidence: "medium" } });
  check("T09 empty CV metadata remains empty (CV optional, not required by this transition)",
    result.cvFilePath === "" && result.cvFileName === "" && result.cvSource === "");
}

// ── T10 — Coach gate state: false remains false ─────────────────────────
{
  const latest = makeModule0({ coachAcknowledged: false });
  const result = buildA0StructuredProfileCheckpoint(latest, {});
  check("T10 coachAcknowledged false remains false (not auto-acknowledged by A0)", result.coachAcknowledged === false);
}

// ── T11 — Education isolation: no module5/degree-shaped output ─────────
{
  const latest = makeModule0();
  const result = buildA0StructuredProfileCheckpoint(latest, {});
  check("T11 no degrees/module5-shaped field reachable from this transition",
    !("degrees" in (result as unknown as Record<string, unknown>)) && !("module5" in (result as unknown as Record<string, unknown>)));
}

// ── T12 — Email conflict semantics: governed purely by acquireField ─────
{
  const existingEmail = acquireField(emptyField(), { value: "invitado@example.com", source: "staff_entered", confidence: "high" });
  const latest = makeModule0({ structuredProfile: { ...emptyStructuredProfile(), email: existingEmail } });
  const result = buildA0StructuredProfileCheckpoint(latest, { email: { value: "cv@example.com", confidence: "high" } });
  const expected = acquireField(existingEmail, { value: "cv@example.com", source: "cv_extraction", confidence: "high" });
  check("T12 email conflict handling delegates entirely to existing acquireField, no special-casing",
    JSON.stringify(result.structuredProfile.email) === JSON.stringify(expected)
    && result.structuredProfile.email.status === "conflicting"
    && result.structuredProfile.email.value === "invitado@example.com");
}

// ── T13 — Professional Candidate callback regression boundary (structural) ──
{
  const src = fs.readFileSync(path.join(__dirname, "../../../src/app/intake/modules/Module0.tsx"), "utf8");
  const runA0 = src.slice(src.indexOf("async function runA0"), src.indexOf("async function handleUpload"));
  check("T13 onProfessionalCandidatesExtracted call remains, same existing condition, after the checkpoint",
    /onCheckpoint\(nextModule0\);[\s\S]*if \(json\.professionalCandidates\) \{\s*onProfessionalCandidatesExtracted\(json\.professionalCandidates as ProfessionalIntelligenceCandidates\);/.test(runA0));
}

// ── T14 — Full coherent payload: output equals {...latest, structuredProfile: merged} ──
{
  const latest = makeModule0({ cvFilePath: "p", cvFileName: "f.pdf", cvSource: "existing", coachAcknowledged: true, coachConversation: [{ role: "assistant" as const, content: "hola", at: "t" }] });
  const extracted = { profession: { value: "Abogado", confidence: "high" as const } };
  const result = buildA0StructuredProfileCheckpoint(latest, extracted);
  let expectedProfile = latest.structuredProfile;
  for (const [key, f] of Object.entries(extracted)) {
    expectedProfile = { ...expectedProfile, [key]: acquireField(expectedProfile[key as keyof typeof expectedProfile], { value: f.value, source: "cv_extraction", confidence: f.confidence }) };
  }
  const expected = { ...latest, structuredProfile: expectedProfile };
  check("T14 full coherent payload matches {...latestModule0, structuredProfile: expectedMergedProfile} exactly", JSON.stringify(result) === JSON.stringify(expected));
}

// ── T15 — Original defect negative proof ────────────────────────────────
{
  const preUploadStale: Module0 = makeModule0({ cvFilePath: "", cvFileName: "", cvSource: "" });
  const latestPostUpload: Module0 = makeModule0({ cvFilePath: "module0/cv/real.pdf", cvFileName: "real.pdf", cvSource: "existing" });
  const result = buildA0StructuredProfileCheckpoint(latestPostUpload, { profession: { value: "Contador", confidence: "high" } });
  check("T15 no stale pre-upload cvFilePath resurfaces", result.cvFilePath !== preUploadStale.cvFilePath && result.cvFilePath === "module0/cv/real.pdf");
  check("T15 no stale pre-upload cvFileName resurfaces", result.cvFileName !== preUploadStale.cvFileName && result.cvFileName === "real.pdf");
  check("T15 no stale pre-upload cvSource resurfaces", result.cvSource !== preUploadStale.cvSource && result.cvSource === "existing");
}

// ── A01 — Post-upload metadata authority ────────────────────────────────
{
  const authoritative = makeModule0({ cvFilePath: "X", cvFileName: "Y", cvSource: "existing" });
  const getCurrentModule0 = () => authoritative;
  const result = composeA0Checkpoint(getCurrentModule0, {});
  check("A01 X/Y/Z survive exactly through composeA0Checkpoint", result.cvFilePath === "X" && result.cvFileName === "Y" && result.cvSource === "existing");
}

// ── A02 — Coach acknowledgement authority ───────────────────────────────
{
  const authoritative = makeModule0({ coachAcknowledged: true });
  const getCurrentModule0 = () => authoritative;
  const result = composeA0Checkpoint(getCurrentModule0, {});
  check("A02 coachAcknowledged true preserved through composeA0Checkpoint", result.coachAcknowledged === true);
}

// ── A03 — Coach conversation authority (exact same array) ──────────────
{
  const conversation = [
    { role: "user" as const, content: "primero", at: "t1" },
    { role: "assistant" as const, content: "segundo", at: "t2" },
  ];
  const authoritative = makeModule0({ coachConversation: conversation });
  const getCurrentModule0 = () => authoritative;
  const result = composeA0Checkpoint(getCurrentModule0, {});
  check("A03 coachConversation preserved as the exact same array reference", result.coachConversation === conversation);
}

// ── A04 — StructuredProfile authority (latest confirmed field governs) ─
{
  const confirmed = confirmField(acquireField(emptyField(), { value: "Colombia", source: "cv_extraction", confidence: "high" }), "beneficiary-1");
  const authoritative = makeModule0({ structuredProfile: { ...emptyStructuredProfile(), countryOfBirth: confirmed } });
  const getCurrentModule0 = () => authoritative;
  const result = composeA0Checkpoint(getCurrentModule0, { countryOfBirth: { value: "México", confidence: "high" } });
  check("A04 existing acquireField semantics applied to the LATEST authoritative field",
    result.structuredProfile.countryOfBirth.status === "conflicting" && result.structuredProfile.countryOfBirth.value === "Colombia");
}

// ── A05 — Authority wiring placement (structural, no React-mount infra) ─
{
  const src = fs.readFileSync(path.join(__dirname, "../../../src/app/intake/IntakeForm.tsx"), "utf8");
  check("A05a module0Ref declared", /const module0Ref = useRef<IntakeFormData\["module0"\]>\(data\.module0\);/.test(src));

  const module0RefDeclIdx = src.indexOf('const module0Ref = useRef<IntakeFormData["module0"]>(data.module0);');
  const dataRefEffectIdx = src.indexOf("useEffect(() => { dataRef.current = data; }, [data]);");
  check("A05b module0Ref not synchronized via its own useEffect",
    !/useEffect\(\(\) => \{\s*module0Ref\.current/.test(src));
  check("A05c module0Ref declared after dataRef's own (unmodified, effect-based) sync, not merged into it",
    module0RefDeclIdx > dataRefEffectIdx);

  check("A05d transition 1 (Module0 onChange receiver) synchronously assigns module0Ref.current = m before setData",
    /onChange=\{m => \{ module0Ref\.current = m; setData\(p => \(\{ \.\.\.p, module0:\s*m \}\)\); \}\}/.test(src));

  const onModule0CheckpointBlock = src.slice(src.indexOf("const onModule0Checkpoint = useCallback"), src.indexOf("const getCurrentModule0 = useCallback"));
  check("A05e transition 2 (onModule0Checkpoint) synchronously assigns module0Ref.current = nextModule0",
    /module0Ref\.current = nextModule0;/.test(onModule0CheckpointBlock) && !/useEffect/.test(onModule0CheckpointBlock));

  const onCoachTurnCheckpointBlock = src.slice(src.indexOf("const onCoachTurnCheckpoint = useCallback"), src.indexOf("const handleProfessionalCandidatesExtracted = useCallback"));
  check("A05f transition 3 (onCoachTurnCheckpoint) synchronously assigns module0Ref.current = finalModule0, after finalModule0 is finalized",
    /const nextData: IntakeFormData = \{ \.\.\.dataRef\.current, module0: finalModule0 \};\s*module0Ref\.current = finalModule0;/.test(onCoachTurnCheckpointBlock)
    && !/useEffect/.test(onCoachTurnCheckpointBlock));

  check("A05g no render-body unconditional module0Ref.current = data.module0 synchronization was introduced",
    !/^\s*module0Ref\.current = data\.module0;\s*$/m.test(src));

  check("A05h getCurrentModule0 reads only module0Ref.current, no fallback to data.module0/dataRef.current.module0",
    /const getCurrentModule0 = useCallback\(\(\) => module0Ref\.current, \[\]\);/.test(src));
}

// ── A06 — Exactly one authority retrieval ───────────────────────────────
{
  let calls = 0;
  const authoritative = makeModule0({ cvFileName: "once.pdf" });
  const getCurrentModule0 = () => { calls++; return authoritative; };
  const result = composeA0Checkpoint(getCurrentModule0, {});
  check("A06a getCurrentModule0 invoked exactly once", calls === 1);
  check("A06b result is based on the single invocation's returned object", result.cvFileName === "once.pdf");
}

console.log(failures === 0 ? `\nALL A0-CHECKPOINT-AUTHORITY CHECKS PASS` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
