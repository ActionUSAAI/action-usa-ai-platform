// A0 completion checkpoint composition (A0 CV METADATA STALE-CLOSURE fix,
// Exact Design + R1 + R2, approved). A0 extraction completion owns ONLY the
// resulting StructuredProfile; every other Module0 field must come from the
// latest authoritative Module0 state, never a stale pre-upload snapshot
// closed over before A0's async request began. Pure, React-free, so the
// real transition logic is directly testable without mounting React (no
// such infrastructure exists in this repository).
import type { Module0 } from "@/app/intake/types";
import { acquireField } from "@/lib/intake/structured-profile";

export function buildA0StructuredProfileCheckpoint(
  latestModule0: Module0,
  extractedFields: Record<string, { value: string; confidence: "high" | "medium" | "low" }>,
): Module0 {
  let profile = latestModule0.structuredProfile;
  for (const [key, f] of Object.entries(extractedFields)) {
    profile = { ...profile, [key]: acquireField(profile[key], { value: f.value, source: "cv_extraction", confidence: f.confidence }) };
  }
  return { ...latestModule0, structuredProfile: profile };
}

// Authority composition seam (R2): getCurrentModule0 is invoked exactly
// once -- the resulting snapshot is the sole Module0 base for this A0
// completion. getCurrentModule0 is a plain injected function (never assumed
// to be ref-backed), so this function itself never touches React.
export function composeA0Checkpoint(
  getCurrentModule0: () => Module0,
  extractedFields: Record<string, { value: string; confidence: "high" | "medium" | "low" }>,
): Module0 {
  const currentModule0 = getCurrentModule0();
  return buildA0StructuredProfileCheckpoint(currentModule0, extractedFields);
}
