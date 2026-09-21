// AUSCIS Intake Intelligence Layer -- Prefill Engine
// (docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md, design
// §5.5). Pure function, framework-agnostic. Maps Structured Profile
// identity fields into the existing Module1 shape without ever
// overwriting a value the beneficiary or staff already entered --
// prefill only ever fills fields that are still genuinely empty.

import type { StructuredProfile } from "./structured-profile";
import { IDENTITY_FIELDS } from "./structured-profile";
import { composeFullName } from "@/app/intake/name-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefillModule1<T extends Record<string, any>>(module1: T, profile: StructuredProfile): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = { ...module1 };
  for (const key of IDENTITY_FIELDS) {
    const field = profile[key];
    if (!field || field.value === null || field.value === "") continue;
    const existing = result[key];
    // No silent overwrite (design §5.5): only fills a field that is
    // currently empty. A beneficiary/staff-entered value, even a
    // partial one, is never replaced by this function.
    if (existing === undefined || existing === null || existing === "") {
      result[key] = field.value;
    }
  }

  // fullName is a derived-only field (types.ts: "derivado automáticamente
  // de familyName/givenName/middleName -- no editar directamente"), never
  // itself a Structured Profile field (excluded from IDENTITY_FIELDS) and
  // never independently writable elsewhere. Module1.tsx's updateNameField()
  // recomputes it on every manual edit to one of the three name fields;
  // this prefill path must keep it in sync the same way, from the
  // RESULTING (post-no-overwrite) name fields, whenever prefill actually
  // changed one of them.
  if (
    result.familyName !== module1.familyName ||
    result.givenName !== module1.givenName ||
    result.middleName !== module1.middleName
  ) {
    result.fullName = composeFullName(result.familyName, result.givenName, result.middleName);
  }

  return result as T;
}
