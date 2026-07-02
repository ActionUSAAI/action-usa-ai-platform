import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const BUCKET = "intake-documents";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── DOCX builder ─────────────────────────────────────────────────────────────

const NAVY = "1B2B5E";

const DECLARATION = (lang: string) =>
  `I, Alexander Clavijo, hereby declare that I am competent to translate the ${lang} language into English and that the foregoing is a summary translation of the attached document.`;

function blank(): Paragraph {
  return new Paragraph({ children: [] });
}

function bodyPara(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: NAVY, size: 22 })],
    spacing: { before: 280, after: 100 },
  });
}

function labelValuePara(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value || "—", size: 22 }),
    ],
    spacing: { after: 100 },
  });
}

function declarationBlock(lang: string): Paragraph[] {
  return [
    blank(),
    new Paragraph({
      children: [new TextRun({ text: DECLARATION(lang), italics: true, size: 20 })],
      spacing: { after: 100 },
    }),
    blank(),
  ];
}

function signatureBlock(lang: string): Paragraph[] {
  return [
    blank(),
    blank(),
    new Paragraph({ children: [new TextRun({ text: "___________________________________", size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: "Alexander Clavijo", bold: true, size: 22 })] }),
    blank(),
    new Paragraph({
      children: [new TextRun({ text: DECLARATION(lang), italics: true, size: 20 })],
    }),
  ];
}

interface DocMeta {
  detected_language: string;
  document_category: string;
  document_type: string;
  document_title: string;
  issued_by: string;
  issued_to: string;
  document_date: string;
  needs_translation: boolean;
}

interface ParsedSection {
  title: string;
  lines: string[];
}

function parseStructured(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let cur: ParsedSection | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("SECTION:")) {
      if (cur) sections.push(cur);
      cur = { title: line.slice(8).trim(), lines: [] };
    } else if (line && cur) {
      cur.lines.push(line);
    }
  }
  if (cur) sections.push(cur);
  return sections;
}

async function buildDocx(meta: DocMeta, content: string): Promise<Buffer> {
  const lang = meta.detected_language;
  const cat  = meta.document_category;

  const headerParas: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: "ACTION USA AI", bold: true, color: NAVY, size: 28 }),
        new TextRun({ text: "  ·  Certified Translation Services", color: "888888", size: 22 }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: cat === "structured" ? "SUMMARY TRANSLATION" : "CERTIFIED TRANSLATION",
          bold: true,
          color: NAVY,
          size: 36,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ];

  const identParas: Paragraph[] =
    cat === "article"
      ? [
          labelValuePara("TITLE", meta.document_title),
          labelValuePara("PUBLISHED BY", meta.issued_by),
          labelValuePara("DATE", meta.document_date),
          labelValuePara("AUTHOR", meta.issued_to),
        ]
      : cat === "letter"
      ? [
          labelValuePara("DOCUMENT", `Letter — ${meta.document_type.replace(/_/g, " ")}`),
          labelValuePara("FROM", meta.issued_by),
          labelValuePara("TO", meta.issued_to),
          labelValuePara("DATE", meta.document_date),
        ]
      : /* structured */ [
          labelValuePara("DOCUMENT", meta.document_type.replace(/_/g, " ").toUpperCase()),
          labelValuePara("ISSUED BY", meta.issued_by),
          labelValuePara("ISSUED TO", meta.issued_to),
          labelValuePara("DATE", meta.document_date),
        ];

  let contentParas: Paragraph[] = [];

  if (!meta.needs_translation || content.trim() === "ENGLISH") {
    contentParas = [blank(), bodyPara("This document is already in English. No translation required.")];
  } else if (cat === "structured") {
    const sections = parseStructured(content);
    const mid = Math.max(1, Math.floor(sections.length / 2));
    sections.forEach((sec, idx) => {
      contentParas.push(sectionHeading(sec.title));
      sec.lines.forEach((line) => {
        const colon = line.indexOf(":");
        if (colon > 0) {
          contentParas.push(
            labelValuePara(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
          );
        } else {
          contentParas.push(bodyPara(line));
        }
      });
      if (idx === mid - 1) {
        contentParas.push(...declarationBlock(lang));
      }
    });
  } else {
    content.split(/\n\n+/).filter((p) => p.trim()).forEach((p) => {
      contentParas.push(bodyPara(p.trim()), blank());
    });
  }

  const doc = new Document({
    creator: "ACTION USA AI",
    title: `Translation — ${meta.document_title}`,
    sections: [{
      children: [
        ...headerParas,
        ...identParas,
        ...(cat === "structured" ? declarationBlock(lang) : []),
        blank(),
        ...contentParas,
        ...signatureBlock(lang),
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

// ── Claude API ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional certified translator and document analyst at ACTION USA AI. You are competent in Spanish, Portuguese, French, and English.

Analyze the provided document and respond using EXACTLY this two-section format — no extra text before or after:

---METADATA---
{"detected_language":"...","document_category":"structured|article|letter","document_type":"...","document_title":"...","issued_by":"...","issued_to":"...","document_date":"...","needs_translation":true}
---TRANSLATION---
[translated content]

CATEGORIES:
- structured: birth certificates, diplomas, transcripts, contracts, licenses, government records, awards
- article: newspaper articles, press releases, academic publications, blog posts
- letter: any letter, recommendation letter, opinion letter, employment letter, reference letter

For STRUCTURED documents, format the translation as named sections with labeled fields:
SECTION: [Section Name]
[Field Name]: [Translated Value]
[Field Name]: [Translated Value]

SECTION: [Next Section Name]
...

For ARTICLE documents: translate the full text, separating paragraphs with a blank line.

For LETTER documents: translate the full letter preserving salutation, all paragraphs, closing, and signature block.

If the document is already in English, set needs_translation to false and write ENGLISH after ---TRANSLATION---.`;

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext] ?? "application/pdf";
}

async function analyzeAndTranslate(
  base64: string,
  mimeType: string,
  hintedType?: string
): Promise<{ meta: DocMeta; content: string }> {
  const isPdf   = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  if (!isPdf && !isImage) throw new Error(`Unsupported file type: ${mimeType}`);

  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: mimeType, data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: mimeType, data: base64 } };

  const headers: Record<string, string> = {
    "x-api-key": ANTHROPIC_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  if (isPdf) headers["anthropic-beta"] = "pdfs-2024-09-25";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: hintedType
              ? `Document type hint: ${hintedType}. Analyze and translate per instructions.`
              : "Analyze and translate this document per instructions.",
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? "";

  const metaMatch    = raw.match(/---METADATA---\s*([\s\S]*?)\s*---TRANSLATION---/);
  const contentMatch = raw.match(/---TRANSLATION---\s*([\s\S]*)$/);

  if (!metaMatch || !contentMatch) {
    throw new Error(`Unexpected Claude response format. Preview: ${raw.slice(0, 300)}`);
  }

  let meta: DocMeta;
  try {
    const parsed = JSON.parse(metaMatch[1].trim());
    meta = {
      detected_language: parsed.detected_language ?? "Unknown",
      document_category: parsed.document_category ?? "letter",
      document_type:     parsed.document_type     ?? "other",
      document_title:    parsed.document_title    ?? "",
      issued_by:         parsed.issued_by         ?? "",
      issued_to:         parsed.issued_to         ?? "",
      document_date:     parsed.document_date     ?? "",
      needs_translation: parsed.needs_translation !== false,
    };
  } catch {
    throw new Error(`Failed to parse metadata JSON from Claude response`);
  }

  return { meta, content: contentMatch[1].trim() };
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let recordId: string | null = null;
  const db = adminDb();

  try {
    const body = await request.json();
    const { case_id, file_path, file_name, document_type } = body as {
      case_id?: string;
      file_path?: string;
      file_name?: string;
      document_type?: string;
    };

    if (!case_id || !file_path || !file_name) {
      return NextResponse.json(
        { error: "Missing required fields: case_id, file_path, file_name" },
        { status: 400 }
      );
    }

    // Return existing completed translation (idempotency)
    const { data: existing } = await db
      .from("document_translations")
      .select("*")
      .eq("case_id", case_id)
      .eq("original_file_path", file_path)
      .eq("status", "completed")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, translation: existing });
    }

    // Create processing record
    const { data: record, error: insertError } = await db
      .from("document_translations")
      .insert({
        case_id,
        status: "processing",
        original_file_path: file_path,
        original_file_name: file_name,
        document_type: document_type ?? null,
      })
      .select("id")
      .single();

    if (insertError || !record) {
      throw new Error(`Failed to create translation record: ${insertError?.message}`);
    }
    recordId = record.id;

    // Download source file from Storage
    const { data: blob, error: downloadError } = await db.storage
      .from(BUCKET)
      .download(file_path);

    if (downloadError || !blob) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = getMimeType(file_name);

    // Detect language and translate via Claude
    const { meta, content } = await analyzeAndTranslate(base64, mimeType, document_type);

    let translationDocxPath: string | null = null;
    let translationDocxName: string | null = null;

    if (meta.needs_translation && content.trim() !== "ENGLISH") {
      const docxBuffer = await buildDocx(meta, content);
      const baseName   = file_name.replace(/\.[^/.]+$/, "");
      const docxName   = `${baseName}_EN.docx`;
      const uploadPath = `${case_id}/translations/${docxName}`;

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(uploadPath, docxBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload translation: ${uploadError.message}`);
      }

      translationDocxPath = uploadPath;
      translationDocxName = docxName;
    }

    const { data: updated } = await db
      .from("document_translations")
      .update({
        status:               "completed",
        detected_language:    meta.detected_language,
        document_category:    meta.document_category,
        document_type:        meta.document_type,
        document_title:       meta.document_title,
        issued_by:            meta.issued_by,
        issued_to:            meta.issued_to,
        document_date:        meta.document_date,
        translated_content:   content,
        translation_docx_path: translationDocxPath,
        translation_docx_name: translationDocxName,
      })
      .eq("id", recordId)
      .select("*")
      .single();

    return NextResponse.json({ success: true, translation: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (recordId) {
      await adminDb()
        .from("document_translations")
        .update({ status: "failed", error_message: message })
        .eq("id", recordId);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
