// CBR Governed Confirmation & Promotion Flow §J — staff review surface,
// pure-function support. Framework-agnostic, no DB access, mirrors the
// separation established by src/lib/intake/structured-profile.ts. These
// functions are imported by src/app/api/cbr/pending-reviews/route.ts (the
// real production caller) so unit tests exercise the actual logic, not a
// reimplementation.

// Migration 040 §(3): src/lib/intake/structured-profile.ts's
// IDENTITY_FIELDS uses givenName/familyName, not the CBR field_key
// vocabulary's firstName/lastName. Every other CBR field_key (email,
// whatsapp, countryOfResidence, cityOfResidence, middleName, dateOfBirth)
// matches the StructuredProfile JSON key directly. TX-02 performs this
// exact translation server-side (see its STEP 4); this mirrors it for the
// review surface's read-only confirmation-timestamp lookup, which must use
// the SAME key TX-02 itself reads, or it would silently read a
// nonexistent key and report a missing timestamp that is actually present
// under a different key.
export function structuredProfileKeyFor(fieldKey: string): string {
  if (fieldKey === "firstName") return "givenName";
  if (fieldKey === "lastName") return "familyName";
  return fieldKey;
}

// §D: the authoritative confirmation timestamp is confirmed_at from the
// STRUCTURED PROFILE SNAPSHOT CAPTURED ON THE SPECIFIC intake_submissions
// ROW that produced the candidate/decision being displayed — never the
// client's current/live structured_profile (which may have been
// reconfirmed again since, and would then describe a LATER confirmation
// than the one that actually produced this candidate), and never a CBR
// record's own created_at/submitted_at/review-open time (none of which are
// a beneficiary confirmation event at all). Missing/malformed data is
// preserved honestly as null — never fabricated.
//
// Corrected this round: the prior version accepted ANY nonempty string,
// including genuinely malformed values like "not-a-date" or a
// whitespace-only string — those were returned as if they were a real
// timestamp, and the UI's own `formatTimestamp` happened to silently
// collapse an invalid `Date` back down to "—" without ever setting the
// separate "(no disponible)" annotation, since the raw string was still
// truthy. `extractConfirmedAt` now validates the value through the SAME
// timestamp parser `isCurrent` relies on (see parseTimestampMicros above)
// and returns null for anything that does not parse as a real, valid
// timestamp — a single, consistent "unavailable" result used identically
// by both the API and the UI, never a fabricated replacement.
//
// Corrected again this round: independent execution against the actual
// export reproduced non-null returns for values the UI's own `new
// Date(value)` cannot render at all ("Invalid Date") -- because the
// PREVIOUS version returned the RAW, UNTRIMMED input string whenever
// parseTimestampMicros validated it (parseTimestampMicros trims its OWN
// internal copy before matching, but that trimmed copy was never what got
// returned to the caller). A leading/trailing-whitespace value is the
// concrete case: `parseTimestampMicros(" ...Z ")` validates successfully
// (it trims first), but `new Date(" ...Z ")` -- the untrimmed string this
// function used to hand back -- is Invalid Date in V8/Node. Fixed by
// validating AND returning the SAME (trimmed) string, never the original.
// This is also what makes the "unavailable" contract now genuinely
// PostgreSQL-equivalent rather than "whatever new Date() happens to
// tolerate": every other case flagged in the same reproduction (an
// out-of-range timezone offset like "+99:99"/"+00:99", and a
// leap-second-shaped "00:00:60") is now rejected by parseTimestampMicros
// itself (see its own corrected comments below), so this function and
// `isCurrent`/`describeNotCurrent` share exactly one validity definition —
// a value this function returns non-null is guaranteed parseable by
// parseTimestampMicros AND renderable by `new Date()` (verified directly:
// every string shape this parser accepts -- 'T' or space date/time
// separator, 'Z' or a numeric offset with or without a colon, 0-6
// fractional digits -- was empirically confirmed renderable by Node's own
// `new Date()` before this fix was written).
export function extractConfirmedAt(
  structuredProfile: Record<string, unknown> | null | undefined,
  fieldKey: string
): string | null {
  if (!structuredProfile) return null;
  const key = structuredProfileKeyFor(fieldKey);
  const field = structuredProfile[key];
  if (!field || typeof field !== "object") return null;
  const confirmedAt = (field as Record<string, unknown>).confirmed_at;
  if (typeof confirmedAt !== "string") return null;
  const trimmed = confirmedAt.trim();
  if (trimmed.length === 0) return null;
  return parseTimestampMicros(trimmed) === null ? null : trimmed;
}

export interface GoverningTuple {
  submissionId: string | null;
  submittedAt: string | null;
}

// Corrected this round: PostgreSQL TIMESTAMPTZ values can be rendered as
// TEXT in more than one valid way for the SAME instant -- a shorter
// fractional-second representation with trailing zeros stripped
// ("...00.1+00:00") vs a fully zero-padded one ("...00.100000+00:00"), or
// the identical instant expressed under a different UTC offset
// ("...T00:00:00+00:00" vs "...T01:00:00+01:00"). Plain lexicographic
// string comparison (the prior version of this file) treats these as
// DIFFERENT and, worse, can rank them in the WRONG direction (independently
// reproduced: ".1+00:00" sorts lexicographically BEFORE ".100000+00:00"
// because '+' (0x2B) sorts before '0' (0x30) at the first differing
// character, even though the two strings denote the EXACT SAME instant) --
// this let a genuinely-tied timestamp be misclassified as strictly newer,
// skipping the UUID tie-break entirely and reversing which submission the
// database itself would treat as governing. Fixed by parsing each
// timestamp into an absolute instant expressed as MICROSECONDS SINCE THE
// EPOCH, stored as a bigint (never a plain millisecond-resolution
// `Date`/number, which would silently collapse two genuinely distinct
// microsecond-precision timestamps that happen to share the same
// millisecond -- PostgreSQL's own TIMESTAMPTZ precision), then comparing
// those bigints directly. This is the SAME (submitted_at, submission_id)
// tuple comparison TX-04's own STEP 7 performs in SQL, now actually
// evaluating "equal instant" the way PostgreSQL does, not the way two
// arbitrary text renderings of it happen to sort.
//
// Returns null for anything that cannot be confidently parsed as a real,
// valid calendar timestamp (wrong shape, out-of-range calendar date, a day
// that does not exist in the given month, an out-of-range timezone offset,
// a leap-second-shaped second=60, or more than 6 fractional-second digits)
// -- callers must fail closed on null, never assume a fallback ordering.
//
// Corrected again this round: independent execution reproduced FOUR
// distinct cases where this function previously returned non-null for a
// string Node's own `new Date()` cannot render at all -- confirming the
// prior "PostgreSQL equivalence" claim was incomplete, not merely a
// display-layer issue:
//   (1)/(2) "+99:99" and "+00:99" -- the offset capture group
//       (`[+-]\d{2}:?\d{2}`) accepted ANY two digits for both the offset
//       hour and minute, with NO range check at all. The round-trip
//       calendar-date check this function already had cannot catch this:
//       it re-derives `check` using the SAME (possibly-garbage)
//       offsetMinutes value used to compute baseMillis in the first place,
//       so it is a self-consistency check on the arithmetic, never an
//       external validity check on the offset itself. Fixed with an
//       explicit range check (0-23 hours, 0-59 minutes -- the same bounds
//       already applied to the main hour/minute fields).
//   (3) "00:00:60" (a leap-second representation) -- PostgreSQL's own
//       TIMESTAMPTZ type does not support leap seconds at all (its valid
//       seconds range is 0-59); this function's prior `second > 60` check
//       let 60 itself through, and JS's `Date.UTC` then SILENTLY rolled it
//       over into the next minute -- a different, wrong instant, not an
//       error, and not what PostgreSQL would do with the same input
//       (reject it). Fixed by rejecting second=60 outright (`second > 59`),
//       matching Postgres's own supported range rather than silently
//       renormalizing into an adjacent instant.
//   (4) More than 6 fractional-second digits -- PostgreSQL's own
//       TIMESTAMPTZ storage precision IS microseconds (exactly 6 digits);
//       a value with more digits than that cannot have genuinely come from
//       an unmodified Postgres round-trip. The prior version silently
//       TRUNCATED anything beyond 6 digits (`.slice(0, 6)`), which could
//       silently discard a real difference between two otherwise-identical
//       timestamps and report them as equal -- exactly the kind of
//       "claims full PostgreSQL equivalence, silently drops precision it
//       does not actually support" gap this correction closes. This
//       function does not attempt to become a general-purpose
//       arbitrary-precision date library: fractional input beyond 6
//       digits is now rejected (null), not truncated.
function parseTimestampMicros(iso: string | null | undefined): bigint | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.(\d+))?(Z|[+-]\d{2}:?\d{2})$/.exec(trimmed);
  if (!m) return null;
  const [, yStr, moStr, dStr, hStr, miStr, sStr, , fracStr, offStr] = m;
  const year = Number(yStr);
  const month = Number(moStr);
  const day = Number(dStr);
  const hour = Number(hStr);
  const minute = Number(miStr);
  const second = Number(sStr);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  if (fracStr && fracStr.length > 6) return null;

  let offsetMinutes = 0;
  if (offStr !== "Z") {
    const sign = offStr[0] === "-" ? -1 : 1;
    const digits = offStr.slice(1).replace(":", "");
    const offH = Number(digits.slice(0, 2));
    const offM = Number(digits.slice(2, 4) || "0");
    if (offH > 23 || offM > 59) return null;
    offsetMinutes = sign * (offH * 60 + offM);
  }

  const baseMillis = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60000;
  if (Number.isNaN(baseMillis)) return null;
  // Date.UTC silently NORMALIZES an out-of-range calendar date (e.g.
  // day=31 in a 30-day month rolls over into the next month) instead of
  // failing -- re-deriving the calendar date from the computed instant and
  // requiring it to match what was actually parsed catches that case
  // rather than silently accepting a rolled-over date as valid. (This is
  // deliberately only a self-consistency check on the DATE component --
  // the offset itself is validated separately, above, since this
  // reconstruction always uses the identical offsetMinutes value that
  // produced baseMillis and therefore cannot detect an invalid offset.)
  const check = new Date(baseMillis + offsetMinutes * 60000);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  const fracDigits = (fracStr ?? "").padEnd(6, "0");
  const micros = fracStr ? BigInt(fracDigits) : BigInt(0);
  return BigInt(baseMillis) * BigInt(1000) + micros;
}

// Distinguishes WHY a candidate/observation is or is not CURRENT, so
// callers can report an ACCURATE reason to staff rather than a single
// collapsed boolean. "missing_data" means the linkage or its timestamp
// could not be established/parsed at all (an integrity/data problem,
// never described to staff as a supersession); "stale" means a genuinely
// parseable, strictly-newer governing event was found (an actual
// supersession by a newer submission). `current: true` always pairs with
// `reason: null` (nothing to explain).
export type NotCurrentReason = "missing_data" | "stale";
interface CurrencyClassification {
  current: boolean;
  reason: NotCurrentReason | null;
}

function classifyCurrency(
  governing: GoverningTuple | undefined,
  candidateSubmittedAt: string | null | undefined,
  candidateSubmissionId: string | null
): CurrencyClassification {
  if (!candidateSubmissionId) return { current: false, reason: "missing_data" };
  const candidateMicros = parseTimestampMicros(candidateSubmittedAt);
  if (candidateMicros === null) return { current: false, reason: "missing_data" };

  // Corrected this round: `!governing.submissionId || !governing.submittedAt` treated EITHER
  // half of the governing tuple being missing as "no governing event yet" -- independently
  // reproduced as incorrectly returning current=true for a PARTIALLY populated tuple (one half
  // set, the other null), not only for a genuinely absent one (both null/undefined). The
  // database's own CHECK constraint (`(governing_submission_id IS NULL) = (governing_submitted_at
  // IS NULL)`) requires both-or-neither, but this function must not simply assume that invariant
  // holds in whatever data it is handed -- a partial tuple is an integrity anomaly, not "no
  // governing event", and must fail closed exactly like a candidate's own missing/invalid data
  // does, never an affirmative CURRENT/RESOLVABLE result.
  const hasGoverningId = !!governing?.submissionId;
  const hasGoverningTs = !!governing?.submittedAt;
  if (!hasGoverningId && !hasGoverningTs) {
    // Genuinely no governing event recorded yet (both absent) -- nothing can be non-current.
    return { current: true, reason: null };
  }
  if (hasGoverningId !== hasGoverningTs) {
    return { current: false, reason: "missing_data" };
  }
  const governingMicros = parseTimestampMicros(governing!.submittedAt);
  // An existing governing pointer whose OWN timestamp fails to parse is an
  // integrity anomaly, not a normal "no governing event yet" state --
  // never silently treated as either "no governing event" or a genuine
  // supersession.
  if (governingMicros === null) return { current: false, reason: "missing_data" };
  if (candidateMicros !== governingMicros) {
    return candidateMicros > governingMicros ? { current: true, reason: null } : { current: false, reason: "stale" };
  }
  return candidateSubmissionId >= governing!.submissionId!
    ? { current: true, reason: null }
    : { current: false, reason: "stale" };
}

// §G's CURRENT test, as a pure function: a candidate/conflict/observation
// row's event-order tuple (submitted_at, submission_id) is not older than
// the field's governing tuple. Mirrors the exact tuple comparison
// cbr_tx04_approve_g3's STEP 7 performs in SQL
// (`(s.submitted_at, s.id) >= (governing_submitted_at, governing_submission_id)`),
// now using genuine instant equality (see parseTimestampMicros above), not
// string equality.
//
// Corrected this round: the candidate's OWN submitted_at is now validated
// BEFORE the "no governing event yet" shortcut is ever reached. The prior
// version checked `!governing` first and unconditionally returned `true`
// in that case -- meaning a candidate with a missing or unparseable
// submitted_at, for a field that happens to have no governing event yet,
// would have been reported CURRENT regardless. Missing/invalid observation
// data must never produce an affirmative (CURRENT, and therefore
// RESOLVABLE) result, independent of whether a governing event exists.
export function isCurrent(
  governing: GoverningTuple | undefined,
  candidateSubmittedAt: string | null | undefined,
  candidateSubmissionId: string | null
): boolean {
  return classifyCurrency(governing, candidateSubmittedAt, candidateSubmissionId).current;
}

// Companion to isCurrent: WHY a candidate is not current, for accurate
// staff-facing messaging. Returns null when it IS current (nothing to
// explain). Callers must never render a "superseded by a newer submission"
// message for a "missing_data" reason -- those are different conditions.
export function describeNotCurrent(
  governing: GoverningTuple | undefined,
  candidateSubmittedAt: string | null | undefined,
  candidateSubmissionId: string | null
): NotCurrentReason | null {
  return classifyCurrency(governing, candidateSubmittedAt, candidateSubmissionId).reason;
}

// §G: RESOLVABLE (TX-04) = DECISION pending AND source_observation_id
// still CURRENT. Pending alone is NOT resolvable — a caller must supply
// the source observation's own event-order tuple, not merely assert
// pending status. This is advisory display logic only: TX-04's own STEP 7
// (under lock) remains the sole authoritative check at approval time: see
// this function's SQL counterpart in migration 040.
export function isResolvable(
  decisionState: string | null,
  governing: GoverningTuple | undefined,
  observationSubmittedAt: string | null | undefined,
  observationSubmissionId: string | null
): boolean {
  if (decisionState !== "pending") return false;
  return isCurrent(governing, observationSubmittedAt, observationSubmissionId);
}
