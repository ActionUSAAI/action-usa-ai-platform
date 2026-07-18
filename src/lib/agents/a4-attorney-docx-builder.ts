import { createClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph, TextRun } from "docx";

// ============================================================
// Builder for A4 Motor Abogado — consumes the structured output
// contracts defined in docs/A4_ENGINE_ABOGADO.md v1.3: Tipo 0
// (Attorney Petition Letter) and Tipo 0b (Consultation Exception
// Letter). Persists to agent_petition_drafts (extended in
// migration 012) and follows the three-phase agent_runs lifecycle
// used by a1-intake-analyzer/route.ts (create running -> complete
// or fail) — required here because agent_petition_drafts.run_id
// is NOT NULL, unlike agent_recommendation_letters (nullable,
// unused by the A3 builders).
//
// Letterhead is rendered as styled text (color + bold), not an
// embedded image — same approach as a2-document-processor's
// certified-translation header (NAVY = "1B2B5E"). No ImageRun
// precedent exists in this codebase for .docx letterheads; the
// logo.png assets in /public are used only by web UI and email,
// never by generated documents.
//
// Real attorney signature (text, not a blank placeholder) per
// A4_ENGINE_ABOGADO.md's explicit "a diferencia de los motores de
// A3, aquí no hay placeholders" — confirmed deliberately kept as
// documented this session, not changed.
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "intake-documents";
const NAVY = "1B2B5E";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// US Letter, per docx skill guidance (page defaults to A4 otherwise).
const US_LETTER_PAGE = { size: { width: 12240, height: 15840 } };

export interface AttorneyLetterContext {
  caseId: string;
  beneficiaryFullName: string;
  visaType: "O-1A" | "O-1B" | "EB-1A" | "EB-1B";
  attorneyName: string;
  firmName: string;
  firmAddress: string;
}

export interface CriterionArgument {
  criterionCitation: string;
  criterionLabel: string;
  argument: string;
  exhibitNumbers: string[];
}

export interface AttorneyPetitionBlocks {
  block1_header: string;
  block2_fieldPresentation: string;
  block3_legalFrameworkStandard: string;
  block4_criteriaSatisfiedDeclaration: string;
  block5_criteriaDevelopment: CriterionArgument[];
  block5_singleAchievementAnalysis: string | null;
  block6_conclusion: string;
  block7_closing: string;
}

export interface AttorneyPetitionInput extends AttorneyLetterContext {
  petitionStrategy: "multiCriteria" | "singleAchievement";
  blocks: AttorneyPetitionBlocks;
}

export interface ConsultationExceptionBlocks {
  block1_header: string;
  block2_reSubject: string;
  block3a_noPeerGroupDeclaration: string;
  block3b_fieldSingularityJustification: string;
  block3c_substituteEvidence: string;
  block4_closing: string;
}

export interface ConsultationExceptionInput extends AttorneyLetterContext {
  blocks: ConsultationExceptionBlocks;
}

export interface BuiltPetitionResult {
  agentPetitionDraftsId: string;
  docxPath: string;
  runId: string;
}

type AdminDb = ReturnType<typeof adminDb>;

function letterheadParagraph(firmName: string, firmAddress: string): Paragraph {
  return new Paragraph({
    spacing: { after: 300 },
    children: [
      new TextRun({ text: firmName, bold: true, color: NAVY, size: 28 }),
      new TextRun({ text: `  ·  ${firmAddress}`, color: "888888", size: 20 }),
    ],
  });
}

function signatureParagraphs(
  closingText: string,
  attorneyName: string
): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 300 },
      children: [new TextRun({ text: closingText })],
    }),
    new Paragraph({
      spacing: { before: 400 },
      children: [new TextRun({ text: attorneyName, bold: true })],
    }),
  ];
}

async function createAgentRun(
  db: AdminDb,
  caseId: string,
  inputSnapshot: Record<string, unknown>
): Promise<string> {
  const { data: run, error } = await db
    .from("agent_runs")
    .insert({
      case_id: caseId,
      agent_name: "petition_builder",
      status: "running",
      started_at: new Date().toISOString(),
      input_snapshot: inputSnapshot,
    })
    .select("id")
    .single();

  if (error || !run) {
    throw new Error(`Failed to create agent run: ${error?.message}`);
  }
  return run.id as string;
}

async function completeAgentRun(
  db: AdminDb,
  runId: string,
  outputSummary: Record<string, unknown>
): Promise<void> {
  await db
    .from("agent_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      output_summary: outputSummary,
    })
    .eq("id", runId);
}

async function failAgentRun(
  db: AdminDb,
  runId: string,
  message: string
): Promise<void> {
  await db
    .from("agent_runs")
    .update({
      status: "failed",
      error_detail: message,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

// ---------- Tipo 0 — Attorney Petition Letter ----------

function buildCriteriaDevelopmentParagraphs(
  criteria: CriterionArgument[]
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  criteria.forEach((c) => {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: `${c.criterionLabel} (${c.criterionCitation})`,
            bold: true,
          }),
        ],
      })
    );
    paragraphs.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: c.argument })],
      })
    );
    if (c.exhibitNumbers.length > 0) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: `See ${c.exhibitNumbers
                .map((e) => `Exhibit ${e}`)
                .join(", ")}.`,
              italics: true,
            }),
          ],
        })
      );
    }
  });
  return paragraphs;
}

async function buildAttorneyPetitionDocx(
  input: AttorneyPetitionInput
): Promise<Buffer> {
  const { blocks } = input;

  const block5Paragraphs =
    input.petitionStrategy === "multiCriteria"
      ? buildCriteriaDevelopmentParagraphs(blocks.block5_criteriaDevelopment)
      : [
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: blocks.block5_singleAchievementAnalysis ?? "",
              }),
            ],
          }),
        ];

  const doc = new Document({
    creator: input.firmName,
    title: `Attorney Petition Letter - ${input.beneficiaryFullName}`,
    sections: [
      {
        properties: { page: US_LETTER_PAGE },
        children: [
          letterheadParagraph(input.firmName, input.firmAddress),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: blocks.block1_header })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: blocks.block2_fieldPresentation })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: blocks.block3_legalFrameworkStandard }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: blocks.block4_criteriaSatisfiedDeclaration }),
            ],
          }),
          ...block5Paragraphs,
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: blocks.block6_conclusion })],
          }),
          ...signatureParagraphs(blocks.block7_closing, input.attorneyName),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function buildAndStoreAttorneyPetitionLetter(
  input: AttorneyPetitionInput
): Promise<BuiltPetitionResult> {
  const db = adminDb();

  const runId = await createAgentRun(db, input.caseId, {
    case_id: input.caseId,
    petition_type: "standard",
    petition_strategy: input.petitionStrategy,
  });

  try {
    const docxBuffer = await buildAttorneyPetitionDocx(input);
    const uploadPath = `${input.caseId}/petition/standard/${runId}.docx`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(uploadPath, docxBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(
        `Failed to upload attorney petition letter: ${uploadError.message}`
      );
    }

    const { data: inserted, error: insertError } = await db
      .from("agent_petition_drafts")
      .insert({
        run_id: runId,
        case_id: input.caseId,
        petition_type: "standard",
        visa_type: input.visaType,
        blocks: input.blocks,
        petition_strategy: input.petitionStrategy,
        docx_path: uploadPath,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      await db.storage.from(BUCKET).remove([uploadPath]).catch(() => {});
      throw new Error(
        `Failed to register attorney petition draft: ${insertError?.message}`
      );
    }

    await completeAgentRun(db, runId, {
      agent_petition_drafts_id: inserted.id,
      docx_path: uploadPath,
    });

    return {
      agentPetitionDraftsId: inserted.id,
      docxPath: uploadPath,
      runId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAgentRun(db, runId, message);
    throw err;
  }
}

// ---------- Tipo 0b — Consultation Exception Letter ----------

async function buildConsultationExceptionDocx(
  input: ConsultationExceptionInput
): Promise<Buffer> {
  const { blocks } = input;

  const doc = new Document({
    creator: input.firmName,
    title: `Consultation Exception Letter - ${input.beneficiaryFullName}`,
    sections: [
      {
        properties: { page: US_LETTER_PAGE },
        children: [
          letterheadParagraph(input.firmName, input.firmAddress),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: blocks.block1_header })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: blocks.block2_reSubject })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: blocks.block3a_noPeerGroupDeclaration }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: blocks.block3b_fieldSingularityJustification,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: blocks.block3c_substituteEvidence })],
          }),
          ...signatureParagraphs(blocks.block4_closing, input.attorneyName),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function buildAndStoreConsultationExceptionLetter(
  input: ConsultationExceptionInput
): Promise<BuiltPetitionResult> {
  const db = adminDb();

  const runId = await createAgentRun(db, input.caseId, {
    case_id: input.caseId,
    petition_type: "consultation_exception",
  });

  try {
    const docxBuffer = await buildConsultationExceptionDocx(input);
    const uploadPath = `${input.caseId}/petition/consultation_exception/${runId}.docx`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(uploadPath, docxBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(
        `Failed to upload consultation exception letter: ${uploadError.message}`
      );
    }

    const { data: inserted, error: insertError } = await db
      .from("agent_petition_drafts")
      .insert({
        run_id: runId,
        case_id: input.caseId,
        petition_type: "consultation_exception",
        visa_type: input.visaType,
        blocks: input.blocks,
        petition_strategy: null,
        docx_path: uploadPath,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      await db.storage.from(BUCKET).remove([uploadPath]).catch(() => {});
      throw new Error(
        `Failed to register consultation exception draft: ${insertError?.message}`
      );
    }

    await completeAgentRun(db, runId, {
      agent_petition_drafts_id: inserted.id,
      docx_path: uploadPath,
    });

    return {
      agentPetitionDraftsId: inserted.id,
      docxPath: uploadPath,
      runId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAgentRun(db, runId, message);
    throw err;
  }
}
