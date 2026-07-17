import { createClient } from "@supabase/supabase-js";
import { createAgentRun, completeAgentRun, failAgentRun } from "./agent-runs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { relationshipLabelEn } from "@/lib/relationship-labels";

// ============================================================
// Builder for A3 Motor Testimonial — consumes the structured
// output contract defined in
// docs/A3_ENGINE_TESTIMONIAL_PERSONAL.md v1.3, renders one
// .docx per letter (never a combined document, since each
// signer prints and signs their own copy), uploads to Supabase
// Storage, and registers each letter in
// agent_recommendation_letters (extended for this purpose in
// migration 010).
//
// Follows the same client/build/upload pattern as
// a2-document-processor/route.ts: a locally-defined adminDb()
// using @supabase/supabase-js + SERVICE_ROLE_KEY, and a local
// buildDocx()-equivalent returning Promise<Buffer> via
// Packer.toBuffer(). Not centralized into a shared helper —
// intentional, to match existing agent route precedent rather
// than introduce a new pattern mid-task.
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "intake-documents";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Section headings shown only in "headed" and "numbered" formats.
// Blocks 1 and 7 are fixed letter structure (header, closing) and
// never carry a section heading regardless of format.
const SECTION_HEADINGS: Record<string, string> = {
  block2_signerAuthority: "Professional Background",
  block3_relationshipNature: "Nature of Our Relationship",
  block4a_originality: "Original Contribution",
  block4b_significance: "Significance and Impact",
  block5_regulatoryConnection: "Relevance to Qualifications",
  block6_supportDeclaration: "Statement of Support",
};

const BODY_BLOCK_ORDER = [
  "block2_signerAuthority",
  "block3_relationshipNature",
  "block4a_originality",
  "block4b_significance",
  "block5_regulatoryConnection",
  "block6_supportDeclaration",
] as const;

export interface TestimonialLetterBlocks {
  block1_header: string;
  block2_signerAuthority: string;
  block3_relationshipNature: string;
  block4a_originality: string;
  block4b_significance: string;
  block5_regulatoryConnection: string;
  block6_supportDeclaration: string;
  block7_closing: string;
}

export interface TestimonialLetterEntry {
  letterId: string;
  presentationFormat: "narrative" | "headed" | "numbered";
  signerName: string;
  signerTitle: string;
  signerCompany: string;
  relationshipType: string; // Module9 slug
  blocks: TestimonialLetterBlocks;
}

export interface TestimonialLettersInput {
  caseId: string;
  beneficiaryFullName: string;
  visaType: string; // Reserved: not consumed by this builder yet — block1_header
                      // already includes classification text from the model's
                      // output. Kept in the contract for future validation use
                      // (e.g., cross-checking against A1's determination).
  criterionCitation: string;
  criterionLabel: string;
  criterionKey: string;
  letters: TestimonialLetterEntry[];
}

export interface BuiltLetterResult {
  letterId: string;
  docxPath: string;
  agentRecommendationLettersId: string;
}

// US Letter, per docx skill guidance (page defaults to A4 otherwise).
const US_LETTER_PAGE = { size: { width: 12240, height: 15840 } };

function buildBodyParagraphs(
  blocks: TestimonialLetterBlocks,
  format: TestimonialLetterEntry["presentationFormat"]
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  BODY_BLOCK_ORDER.forEach((key, index) => {
    const text = blocks[key];
    if (!text) return;

    if (format === "headed" || format === "numbered") {
      const headingText =
        format === "numbered"
          ? `${index + 1}. ${SECTION_HEADINGS[key]}`
          : SECTION_HEADINGS[key];
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: headingText, bold: true })],
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text })],
      })
    );
  });

  return paragraphs;
}

async function buildTestimonialDocx(
  entry: TestimonialLetterEntry,
  beneficiaryFullName: string
): Promise<Buffer> {
  const bodyParagraphs = buildBodyParagraphs(
    entry.blocks,
    entry.presentationFormat
  );

  const doc = new Document({
    creator: "ACTION USA AI",
    title: `Testimonial Letter - ${beneficiaryFullName} - ${entry.signerName}`,
    sections: [
      {
        properties: { page: US_LETTER_PAGE },
        children: [
          new Paragraph({
            spacing: { after: 300 },
            children: [new TextRun({ text: entry.blocks.block1_header })],
          }),
          ...bodyParagraphs,
          new Paragraph({
            spacing: { before: 300 },
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: entry.blocks.block7_closing })],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function buildAndStoreTestimonialLetters(
  input: TestimonialLettersInput
): Promise<BuiltLetterResult[]> {
  const db = adminDb();
  const results: BuiltLetterResult[] = [];

  const runId = await createAgentRun(db, input.caseId, "letter_generator", {
    case_id: input.caseId,
    motor: "testimonial",
    criterion_key: input.criterionKey,
    letter_count: input.letters.length,
  });

  try {
  for (const entry of input.letters) {
    const docxBuffer = await buildTestimonialDocx(entry, input.beneficiaryFullName);
    const uploadPath = `${input.caseId}/letters/testimonial/${entry.letterId}.docx`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(uploadPath, docxBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(
        `Failed to upload testimonial letter ${entry.letterId}: ${uploadError.message}`
      );
    }

    const relationshipEn = relationshipLabelEn(entry.relationshipType);
    const plainTextSummary = [
      entry.blocks.block1_header,
      entry.blocks.block2_signerAuthority,
      entry.blocks.block3_relationshipNature,
      entry.blocks.block4a_originality,
      entry.blocks.block4b_significance,
      entry.blocks.block5_regulatoryConnection,
      entry.blocks.block6_supportDeclaration,
      entry.blocks.block7_closing,
    ].join("\n\n");

    const { data: inserted, error: insertError } = await db
      .from("agent_recommendation_letters")
      .insert({
        run_id: runId,
        case_id: input.caseId,
        recommender_name: entry.signerName,
        recommender_title: entry.signerTitle,
        recommender_org: entry.signerCompany,
        relationship_type: entry.relationshipType,
        criterion_covered: `${input.criterionCitation} — ${input.criterionLabel}`,
        criterion_key: input.criterionKey,
        letter_draft: plainTextSummary,
        motor: "testimonial",
        presentation_format: entry.presentationFormat,
        blocks: entry.blocks,
        docx_path: uploadPath,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(
        `Failed to register testimonial letter ${entry.letterId}: ${insertError?.message}`
      );
    }

    results.push({
      letterId: entry.letterId,
      docxPath: uploadPath,
      agentRecommendationLettersId: inserted.id,
    });

    // relationshipEn is computed for future use in Block 3 templating
    // upstream (in the prompt), not consumed here — the builder only
    // stores the raw slug. Referenced to avoid an unused-variable lint
    // error until that upstream wiring exists.
    void relationshipEn;
  }

    await completeAgentRun(db, runId, { letters_generated: results.length });
    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAgentRun(db, runId, message);
    throw err;
  }
}
