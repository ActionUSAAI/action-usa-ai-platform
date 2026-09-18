// AUSCIS Intake Intelligence Layer -- Prefill Engine
// (docs/AUSCIS_INTAKE_INTELLIGENCE_LAYER_FINAL_EXACT_DESIGN.md, design
// §5.5). Pure function, framework-agnostic. Maps Structured Profile
// identity fields into the existing Module1 shape without ever
// overwriting a value the beneficiary or staff already entered --
// prefill only ever fills fields that are still genuinely empty.

import type { StructuredProfile } from "./structured-profile";
import { IDENTITY_FIELDS } from "./structured-profile";

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
  return result as T;
}
