import fs from "fs";
import path from "path";

// Minimal real AKAE governed-knowledge lookup, bounded to this slice.
// Reads the existing LKA-* corpus under docs/legal-corpus/O1 — the only
// governed legal-knowledge source that actually exists in this repository
// today. Returns NOT_ACQUIRED, honestly, when a citation has no matching
// record — this is never converted into fabricated or inferred content.
// Internal AKAE storage representation (LKA-* markdown corpus). Consumers
// outside this module should use governed-knowledge-delivery.ts instead of
// this file directly, to avoid coupling to file paths / raw markdown shape.
export type GovernedLookupStatus = "FOUND_AND_VERIFIED" | "FOUND_BUT_NOT_VERIFIED" | "NOT_ACQUIRED";

export interface GovernedLookupResult {
  status: GovernedLookupStatus;
  citation: string;
  content: string | null;
  sourceFile: string | null;
  registryStatus: string | null;
  // Raw "## Verificación" section text, when present — the actual persisted
  // evidence read from the record, not an inference from file existence.
  verificationEvidence: string | null;
}

const CORPUS_DIR = path.join(process.cwd(), "docs", "legal-corpus", "O1");

function normalizeCitation(raw: string): string {
  return raw.trim().replace(/^8\s*CFR\s+/i, "8CFR:").replace(/\s+/g, "");
}

function extractSection(content: string, heading: string): string | null {
  // No "m" flag: "$" must mean true end-of-string here. With "m", "$" also
  // matches before every internal newline, truncating multi-line sections
  // (e.g. a paragraph followed by a table) at their first line.
  const re = new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n\\n## |$)`);
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

// Reads the "Resultado" row of the "## Verificación" table, if the section
// exists at all. Absence of the section (or of a "Resultado: Verified" row
// within it) means NOT verified — never inferred from the LKA file existing.
function isVerified(verificationSection: string | null): boolean {
  if (!verificationSection) return false;
  const match = verificationSection.match(/\|\s*Resultado\s*\|\s*([^|]+?)\s*\|/);
  return match ? match[1].trim() === "Verified" : false;
}

function notAcquired(citation: string): GovernedLookupResult {
  return {
    status: "NOT_ACQUIRED",
    citation,
    content: null,
    sourceFile: null,
    registryStatus: null,
    verificationEvidence: null,
  };
}

export function lookupGovernedKnowledge(citation: string): GovernedLookupResult {
  const target = normalizeCitation(citation);

  // AKAE failure isolation: a governed-knowledge capability is additive to
  // A1's evaluation, never load-bearing for it. If the corpus is
  // unreachable (packaging/infra failure), this must degrade to the same
  // NOT_ACQUIRED shape a genuinely missing citation already produces --
  // never let a filesystem failure here throw out of this module and take
  // down A1's whole run. Scoped tightly to the fs boundary only; nothing
  // else in this function is caught here.
  let files: string[];
  try {
    files = fs.readdirSync(CORPUS_DIR).filter(f => f.startsWith("LKA-") && f.endsWith(".md"));
  } catch (err) {
    console.error(
      `[AKAE] governed-knowledge corpus UNREACHABLE at ${CORPUS_DIR} (infra/packaging failure, not a missing citation):`,
      err instanceof Error ? err.message : err
    );
    return notAcquired(citation);
  }

  for (const file of files) {
    const full = path.join(CORPUS_DIR, file);
    let content: string;
    try {
      content = fs.readFileSync(full, "utf-8");
    } catch (err) {
      console.error(
        `[AKAE] governed-knowledge corpus file UNREADABLE at ${full} (infra/packaging failure, not a missing citation):`,
        err instanceof Error ? err.message : err
      );
      continue;
    }
    const identifier = extractSection(content, "Identificador");
    if (identifier && normalizeCitation(identifier) === target) {
      const verificationEvidence = extractSection(content, "Verificación");
      return {
        status: isVerified(verificationEvidence) ? "FOUND_AND_VERIFIED" : "FOUND_BUT_NOT_VERIFIED",
        citation,
        content: extractSection(content, "Texto literal"),
        sourceFile: full,
        registryStatus: extractSection(content, "Estado del Registro"),
        verificationEvidence,
      };
    }
  }

  return notAcquired(citation);
}
