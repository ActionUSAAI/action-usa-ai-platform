// AUSCIS Intake Module Numbering — Canonical ↔ Legacy Compatibility Map
// (Intake Module Numbering Canonicalization, Exact Design Option C, C1).
//
// Pure, framework-agnostic, side-effect-free. No DB/Storage/UI dependency.
//
// Historical context (full account: docs/intake/MODULE-NUMBERING-HISTORY.md,
// to be authored in C9): the original Intake had a Module 3 ("Family
// group") whose content was later merged into Module 2 and removed from
// the visible flow; the remaining source components were never
// renumbered, leaving the beneficiary-visible module number permanently
// offset from the historical source/persistence numbering from Module 3
// onward — non-uniformly (the Exact Design proved +1 for Module3..
// Module11, +2 for Module12..Module13, and Summary outside the pattern
// entirely).
//
// This module is the SINGLE authoritative, explicit (non-arithmetic)
// translation between:
//   - CanonicalModuleId — the beneficiary-visible-numbering-aligned
//     identity this and future canonicalized source should use, and
//   - the LEGACY data key / Storage namespace — the historical, frozen,
//     never-to-be-renumbered persistence contract (DB columns, RPC
//     parameters, localStorage draft shape, Storage object paths).
//
// LEGACY DATA KEY and LEGACY STORAGE NAMESPACE are deliberately two
// separate maps below, even where today's values happen to coincide — a
// future change to one must never silently redefine the other.

export type CanonicalModuleId =
  | "Module0" | "Module1" | "Module2" | "Module3" | "Module4" | "Module5"
  | "Module6" | "Module7" | "Module8" | "Module9" | "Module10" | "Module11"
  | "Module12" | "Module13" | "Summary";

export const CANONICAL_MODULE_IDS: readonly CanonicalModuleId[] = [
  "Module0", "Module1", "Module2", "Module3", "Module4", "Module5",
  "Module6", "Module7", "Module8", "Module9", "Module10", "Module11",
  "Module12", "Module13", "Summary",
] as const;

// Canonical -> legacy IntakeFormData property key / intake_submissions
// column / RPC parameter name. Explicit per-entry — NEVER derived by
// arithmetic offset. Summary intentionally has no entry: it persists no
// module-specific data of its own (it consumes only the computed
// statuses array, never its own IntakeFormData key).
//
// LEGACY_RESERVED_UNUSED: the persistence-layer "module3" column/RPC key
// (migration 001_aucis_intake.sql's own "-- Family group" comment) is a
// permanent, always-empty historical vestige and is deliberately absent
// from every value below — no canonical identity may ever resolve to it.
const CANONICAL_TO_LEGACY_DATA_KEY: Partial<Record<CanonicalModuleId, string>> = {
  Module0: "module0",
  Module1: "module1",
  Module2: "module2",
  Module3: "module4",
  Module4: "module5",
  Module5: "module6",
  Module6: "module7",
  Module7: "module8",
  Module8: "module9",
  Module9: "module10",
  Module10: "module11",
  Module11: "module12",
  Module12: "module14",
  Module13: "module15",
};

export function legacyDataKey(id: CanonicalModuleId): string | null {
  return CANONICAL_TO_LEGACY_DATA_KEY[id] ?? null;
}

// Canonical -> legacy Storage object-path prefix. A SEPARATE contract
// from the data-key map above, even though today's four entries happen
// to share the same numeric string as their data-key counterpart — that
// is current source fact, not a derivation rule.
//
// Only canonical modules that CURRENTLY have a numeric legacy Storage
// namespace are listed, verified against every FileUpload call site in
// src/app/intake/modules/*.tsx: Module4 (Educación Formal, degrees),
// Module5 (Cursos y Certificaciones, certifications), Module9
// (Evidencia Existente, 4 upload sites), Module10 (Información
// Estratégica, strategic-answer attachments). Every other canonical
// identity is deliberately absent — in particular Module12/Module13,
// whose current Storage prefixes ("petitioner/...", "consultative/...",
// "companions/...") are already semantic and non-numeric, and must
// never be converted into a numeric namespace merely for symmetry.
const CANONICAL_TO_LEGACY_STORAGE_PREFIX: Partial<Record<CanonicalModuleId, string>> = {
  Module4: "module5",
  Module5: "module6",
  Module9: "module10",
  Module10: "module11",
};

export function legacyStoragePrefix(id: CanonicalModuleId): string | null {
  return CANONICAL_TO_LEGACY_STORAGE_PREFIX[id] ?? null;
}
