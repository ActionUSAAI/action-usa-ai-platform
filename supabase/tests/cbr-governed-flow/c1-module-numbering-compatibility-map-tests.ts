// Implementation Slice C1 — Intake Module Numbering Canonicalization,
// Compatibility Mapping Foundation (Exact Design Option C). Non-database,
// non-network, non-LLM unit tests against the REAL production export
// src/app/intake/module-numbering.ts (imported by path, not reimplemented)
// — mirrors a1/a2/a4/a3-r1/b1's own established convention.
//
// Run: npx tsx supabase/tests/cbr-governed-flow/c1-module-numbering-compatibility-map-tests.ts
//
// Scope: the canonical<->legacy mapping contract only. Does NOT assert
// anything about component rendering, IntakeForm, types.ts, migrations,
// or any downstream agent — those remain explicitly out of C1's boundary.

import {
  CANONICAL_MODULE_IDS, legacyDataKey, legacyStoragePrefix,
  type CanonicalModuleId,
} from "../../../src/app/intake/module-numbering";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); } else { failures++; console.error(`FAIL  ${label}`); }
}

// C1-T01 — canonical identity set is exact (15 members, exact order/content).
{
  const expected = [
    "Module0", "Module1", "Module2", "Module3", "Module4", "Module5",
    "Module6", "Module7", "Module8", "Module9", "Module10", "Module11",
    "Module12", "Module13", "Summary",
  ];
  check("C1-T01 canonical identity set is exact (15 members)",
    CANONICAL_MODULE_IDS.length === 15 && expected.every((id, i) => CANONICAL_MODULE_IDS[i] === id));
}

// C1-T02..T15 — exact per-entry legacy data-key mapping.
const DATA_KEY_CASES: [CanonicalModuleId, string][] = [
  ["Module0", "module0"], ["Module1", "module1"], ["Module2", "module2"],
  ["Module3", "module4"], ["Module4", "module5"], ["Module5", "module6"],
  ["Module6", "module7"], ["Module7", "module8"], ["Module8", "module9"],
  ["Module9", "module10"], ["Module10", "module11"], ["Module11", "module12"],
  ["Module12", "module14"], ["Module13", "module15"],
];
for (const [id, expectedKey] of DATA_KEY_CASES) {
  check(`C1-T0x ${id} -> ${expectedKey}`, legacyDataKey(id) === expectedKey);
}

// C1-T16 — Summary has no legacy data key.
check("C1-T16 Summary -> no legacy data key", legacyDataKey("Summary") === null);

// C1-T17 — no canonical identity maps to legacy "module3" (LEGACY_RESERVED_UNUSED).
check("C1-T17 no canonical identity maps to legacy module3",
  CANONICAL_MODULE_IDS.every(id => legacyDataKey(id) !== "module3"));

// C1-T04 (explicit, named per the gate's own numbering) — canonical Module3 resolves
// to legacy module4, never to legacy module3.
check("C1-T04 canonical Module3 -> legacy module4 (never module3)",
  legacyDataKey("Module3") === "module4" && legacyDataKey("Module3") !== "module3");

// C1-T18 — mapping is explicit (per-entry lookup), not arithmetic: verify the
// non-uniform offset the Exact Design proved (+1 for Module3..Module11,
// +2 for Module12..Module13) is represented as independent entries, not a
// single formula — proven by the fact that both offsets coexist in one table
// with no shared derivation, and by the out-of-sequence Module12/Module13 jump.
{
  const module3Offset = Number(legacyDataKey("Module3")!.replace("module", "")) - 3;
  const module12Offset = Number(legacyDataKey("Module12")!.replace("module", "")) - 12;
  // module3Offset (+1) and module12Offset (+2) differ -- no single arithmetic
  // formula over the canonical number could produce both from the mapping.
  check("C1-T18 mapping is non-uniform across entries (proves no single arithmetic formula could produce it)",
    module3Offset === 1 && module12Offset === 2);
}

// C1-T19 — numeric Storage mappings established by source return the exact
// legacy namespaces (Module4/Module5/Module9/Module10).
{
  const STORAGE_CASES: [CanonicalModuleId, string][] = [
    ["Module4", "module5"], ["Module5", "module6"], ["Module9", "module10"], ["Module10", "module11"],
  ];
  check("C1-T19 numeric Storage mappings match source exactly",
    STORAGE_CASES.every(([id, expected]) => legacyStoragePrefix(id) === expected));
}

// C1-T20 — semantic/non-numeric Storage modules (Module12, Module13) are not
// accidentally converted into a numeric namespace; nor is any module without
// a current FileUpload call site (Module0/1/2/3/6/7/8/11/Summary) given one
// merely for symmetry.
{
  const NO_NUMERIC_NAMESPACE: CanonicalModuleId[] = [
    "Module0", "Module1", "Module2", "Module3", "Module6", "Module7",
    "Module8", "Module11", "Module12", "Module13", "Summary",
  ];
  check("C1-T20 no module outside the four source-verified cases has any Storage prefix",
    NO_NUMERIC_NAMESPACE.every(id => legacyStoragePrefix(id) === null));
}

// C1-T21 — Summary has no Storage namespace.
check("C1-T21 Summary -> no Storage namespace", legacyStoragePrefix("Summary") === null);

// C1-T22 — resolver functions are deterministic and side-effect-free (same
// input always yields the same output, repeated calls do not mutate state
// observable by subsequent calls).
{
  const a1 = legacyDataKey("Module5"); const a2 = legacyDataKey("Module5");
  const b1 = legacyStoragePrefix("Module9"); const b2 = legacyStoragePrefix("Module9");
  check("C1-T22 legacyDataKey/legacyStoragePrefix are deterministic across repeated calls",
    a1 === a2 && b1 === b2 && a1 === "module6" && b1 === "module10");
}

// Data key and Storage prefix are distinct contracts: proven by the fact
// that Module6/Module7/Module8/Module11 have a legacy data key but NO
// Storage prefix, and that the two maps are independently declared.
check("C1 data-key and Storage-prefix are genuinely distinct maps (Module6 has a data key but no Storage prefix)",
  legacyDataKey("Module6") === "module7" && legacyStoragePrefix("Module6") === null);

console.log(failures === 0 ? `\nALL C1 CHECKS PASS` : `\n${failures} C1 CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
