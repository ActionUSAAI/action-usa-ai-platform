import { createClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph, TextRun } from "docx";

// ============================================================
// Builder for A3 Motor Institucional — consumes the structured
// output contract defined in docs/A3_ENGINE_INSTITUCIONAL.md
// v1.4, renders one .docx per letter, uploads to Supabase
// Storage, and registers each letter in
// agent_recommendation_letters (extended in migration 010,
// relationship_type made motor-conditional in migration 011).
//
// Unlike the Testimonial builder, there is no presentationFormat
// variation (each institutional letter targets a distinct
// organization, not a shared perceptual "batch" before the same
// examiner — see A3_ENGINE_INSTITUCIONAL.md "Mecanismo de
// variación"). Layout is always sequential blocks without
// section headings.
//
// Follows the same local adminDb() + service_role pattern as
// a2-document-processor/route.ts and
// a3-testimonial-docx-builder.ts.
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "intake-documents";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type InstitutionalLetterType =
  | "subtypeA_advisory"
  | "subtypeB_judge"
  | "subtypeB_criticalRole4a"
  | "subtypeB_criticalRole4b"
  | "subtypeB_awards";

export interface InstitutionalLetterBlocks {
  block1_header: string;
  block2_organizationIdentity: string;
  block3_coreContent: string;
  block3b_specificReinforcement: string | null;
  block4_declaration: string;
  block5_closing: string;
}

export interface InstitutionalLetterEntry {
  letterId: string;
  letterType: InstitutionalLetterType;
  organizationName: string;
  // null only for subtypeA_advisory — it is not evidence of a
  // numbered criterion, unlike the four Subtype B sub-criteria.
  criterionCitation: string | null;
  criterionLabel: string | null;
  blocks: InstitutionalLetterBlocks;
}

export interface InstitutionalLettersInput {
  caseId: string;
  beneficiaryFullName: string;
  letters: InstitutionalLetterEntry[];
}

export interface BuiltLetterResult {
  letterId: string;
  docxPath: string;
  agentRecommendationLettersId: string;
}

// US Letter, per docx skill guidance (page defaults to A4 otherwise).
const US_LETTER_PAGE = { size: { width: 12240, height: 15840 } };

const ADVISORY_OPINION_CRITERION_LABEL =
  "Advisory Opinion / Consultation Requirement";

function buildBodyParagraphs(blocks: InstitutionalLetterBlocks): Paragraph[] {
  const bodyTexts = [
    blocks.block2_organizationIdentity,
    blocks.block3_coreContent,
    blocks.block3b_specificReinforcement, // omitted below if null
    blocks.block4_declaration,
  ];

  return bodyTexts
    .filter((text): text is string => Boolean(text))
    .map(
      (text) =>
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text })],
        })
    );
}

async function buildInstitutionalDocx(
  entry: InstitutionalLetterEntry,
  beneficiaryFullName: string
): Promise<Buffer> {
  const bodyParagraphs = buildBodyParagraphs(entry.blocks);

  const doc = new Document({
    creator: "ACTION USA AI",
    title: `Institutional Letter - ${beneficiaryFullName} - ${entry.organizationName}`,
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
            children: [new TextRun({ text: entry.blocks.block5_closing })],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function buildAndStoreInstitutionalLetters(
  input: InstitutionalLettersInput
): Promise<BuiltLetterResult[]> {
  const db = adminDb();
  const results: BuiltLetterResult[] = [];

  for (const entry of input.letters) {
    const docxBuffer = await buildInstitutionalDocx(
      entry,
      input.beneficiaryFullName
    );
    const uploadPath = `${input.caseId}/letters/institutional/${entry.letterId}.docx`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(uploadPath, docxBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(
        `Failed to upload institutional letter ${entry.letterId}: ${uploadError.message}`
      );
    }

    const criterionCovered =
      entry.criterionCitation && entry.criterionLabel
        ? `${entry.criterionCitation} — ${entry.criterionLabel}`
        : ADVISORY_OPINION_CRITERION_LABEL;

    const plainTextSummary = [
      entry.blocks.block1_header,
      entry.blocks.block2_organizationIdentity,
      entry.blocks.block3_coreContent,
      entry.blocks.block3b_specificReinforcement,
      entry.blocks.block4_declaration,
      entry.blocks.block5_closing,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: inserted, error: insertError } = await db
      .from("agent_recommendation_letters")
      .insert({
        case_id: input.caseId,
        recommender_name: entry.organizationName,
        recommender_title: null,
        recommender_org: entry.organizationName,
        relationship_type: null,
        criterion_covered: criterionCovered,
        letter_draft: plainTextSummary,
        motor: "institutional",
        letter_type: entry.letterType,
        blocks: entry.blocks,
        docx_path: uploadPath,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error(
        `Failed to register institutional letter ${entry.letterId}: ${insertError?.message}`
      );
    }

    results.push({
      letterId: entry.letterId,
      docxPath: uploadPath,
      agentRecommendationLettersId: inserted.id,
    });
  }

  return results;
}
