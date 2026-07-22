import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const I129_FILL_ENDPOINT = "https://actionusaai.com/api/i129_fill";
const BUCKET = "intake-documents";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================================
// POST /api/agents/a4-i129-form — primera versión de prueba de
// arquitectura, alcance intencionalmente parcial: solo Part 1
// (Petitioner Information) + nombre del beneficiario (Part 3,
// parcial) + checkbox O-1A. Objetivo: validar que la cadena
// completa (caso real → datos → PDF) funciona de punta a punta,
// antes de invertir en mapear el resto del formulario (~250
// campos adicionales, docs/i129-form-mapping/README.md).
//
// NO genera un I-129 listo para radicar todavía — el resto del
// formulario queda en blanco. No persiste registro en base de
// datos (pendiente: tabla i129_form_drafts, pieza separada).
//
// Los estados de "marcado" de checkboxes nuevos (más allá de
// a_O1A, ya verificado) asumen "/1" sin verificación individual
// — riesgo aceptado explícitamente; corregir si la prueba visual
// revela algún checkbox que no aparece marcado en Adobe Reader.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildI129FieldValues(m1: Record<string, any>, m14: Record<string, any>): Record<string, string> {
  const fv: Record<string, string> = {};

  if (m14.petitionerType === "empresa") {
    fv["form1[0].#subform[0].Line3_CompanyorOrgName[0]"] = m14.companyName ?? "";
    fv["form1[0].#subform[0].TextField1[0]"] = m14.ein ?? "";
    fv["form1[0].#subform[0].Line7b_StreetNumberName[0]"] = m14.companyStreetNumberName ?? "";
    fv["form1[0].#subform[0].Line3_AptSteFlrNumber[0]"] = m14.companyAptSteFlrNumber ?? "";
    fv["form1[0].#subform[0].Line_CityTown[0]"] = m14.companyCity ?? "";
    fv["form1[0].#subform[0].P1_Line3_State[0]"] = m14.companyState ?? "";
    fv["form1[0].#subform[0].P1_Line3_ZipCode[0]"] = m14.companyZipCode ?? "";
    fv["form1[0].#subform[0].Line2_DaytimePhoneNumber1_Part8[0]"] = m14.companyDaytimePhone ?? "";
    fv["form1[0].#subform[0].Line3_MobilePhoneNumber1_Part8[0]"] = m14.companyMobilePhone ?? "";
    fv["form1[0].#subform[0].Line9_EmailAddress[0]"] = m14.companyEmail ?? "";
    if (m14.companyAptSteFlr === "STE") fv["form1[0].#subform[0].Line3_Unit[0]"] = "/1";
    if (m14.companyAptSteFlr === "APT") fv["form1[0].#subform[0].Line3_Unit[1]"] = "/1";
    if (m14.companyAptSteFlr === "FLR") fv["form1[0].#subform[0].Line3_Unit[2]"] = "/1";
  } else if (m14.petitionerType === "persona_natural") {
    fv["form1[0].#subform[0].Line1_FamilyName[0]"] = m14.petitionerFamilyName ?? "";
    fv["form1[0].#subform[0].Line1_GivenName[0]"] = m14.petitionerGivenName ?? "";
    fv["form1[0].#subform[0].Line1_MiddleName[0]"] = m14.petitionerMiddleName ?? "";
    fv["form1[0].#subform[0].Line7b_StreetNumberName[0]"] = m14.petitionerStreetNumberName ?? "";
    fv["form1[0].#subform[0].Line3_AptSteFlrNumber[0]"] = m14.petitionerAptSteFlrNumber ?? "";
    fv["form1[0].#subform[0].Line_CityTown[0]"] = m14.petitionerCity ?? "";
    fv["form1[0].#subform[0].P1_Line3_State[0]"] = m14.petitionerState ?? "";
    fv["form1[0].#subform[0].P1_Line3_ZipCode[0]"] = m14.petitionerZipCode ?? "";
    fv["form1[0].#subform[0].Line2_DaytimePhoneNumber1_Part8[0]"] = m14.petitionerDaytimePhone ?? "";
    fv["form1[0].#subform[0].Line3_MobilePhoneNumber1_Part8[0]"] = m14.petitionerMobilePhone ?? "";
    fv["form1[0].#subform[0].Line9_EmailAddress[0]"] = m14.petitionerEmail ?? "";
    if (m14.petitionerAptSteFlr === "STE") fv["form1[0].#subform[0].Line3_Unit[0]"] = "/1";
    if (m14.petitionerAptSteFlr === "APT") fv["form1[0].#subform[0].Line3_Unit[1]"] = "/1";
    if (m14.petitionerAptSteFlr === "FLR") fv["form1[0].#subform[0].Line3_Unit[2]"] = "/1";
  }

  fv["form1[0].#subform[0].P1Line6_No[0]"] = "/1";
  fv["form1[0].#subform[1].Line4_SSN[0]"] = m14.petitionerSSN ?? "";
  fv["form1[0].#subform[1].Line3_TaxNumber[0]"] = m14.petitionerITIN ?? "";
  fv["form1[0].#subform[1].Part2_ClassificationSymbol[0]"] = "O-1A";

  const basisMap: Record<string, string> = {
    new: "form1[0].#subform[1].new[0]",
    change: "form1[0].#subform[1].change[0]",
    concurrent: "form1[0].#subform[1].concurrent[0]",
    amended: "form1[0].#subform[1].amended[0]",
    continuation: "form1[0].#subform[1].continuation[0]",
    previouschange: "form1[0].#subform[1].previouschange[0]",
  };
  if (m14.basisForClassification && basisMap[m14.basisForClassification]) {
    fv[basisMap[m14.basisForClassification]] = "/1";
  }

  const actionMap: Record<string, string> = {
    notify_office: "form1[0].#subform[1].P2Checkbox4[0]",
    change_status_extend: "form1[0].#subform[1].P2Checkbox4[1]",
    extend_stay: "form1[0].#subform[1].P2Checkbox4[2]",
    amend_stay: "form1[0].#subform[1].P2Checkbox4[3]",
  };
  if (m14.requestedAction && actionMap[m14.requestedAction]) {
    fv[actionMap[m14.requestedAction]] = "/1";
  }

  fv["form1[0].#subform[1].TtlNumbersofWorker[0]"] = "1";
  fv["form1[0].#subform[1].P3Line1_Checkbox[1]"] = "/1";
  fv["form1[0].#subform[1].Part3_Line2_FamilyName[0]"] = m1.familyName ?? "";
  fv["form1[0].#subform[1].Part3_Line2_GivenName[0]"] = m1.givenName ?? "";
  fv["form1[0].#subform[1].Part3_Line2_MiddleName[0]"] = m1.middleName ?? "";

  fv["form1[0].#subform[2].Line6_DateOfBirth[0]"] = m1.dateOfBirth ?? "";
  fv["form1[0].#subform[2].Part3Line4_CountryOfBirth[0]"] = m1.countryOfBirth ?? "";
  fv["form1[0].#subform[2].Part3Line4_CountryOfCitizenship[0]"] = m1.nationalities ?? "";

  fv["form1[0].#subform[3].Line2b_StreetNumberName[0]"] = m1.beneficiaryForeignStreetNumberName ?? "";
  fv["form1[0].#subform[3].Line2c_CityTown[0]"] = m1.beneficiaryForeignCity ?? "";
  fv["form1[0].#subform[3].Line2g2_Province[1]"] = m1.beneficiaryForeignProvince ?? "";
  fv["form1[0].#subform[3].Line3f_PostalCode[0]"] = m1.beneficiaryForeignPostalCode ?? "";
  fv["form1[0].#subform[3].Line_Country[0]"] = m1.beneficiaryForeignCountry ?? "";
  // NOTA: sin campo de tipo de unidad (Apt/Ste/Flr) para dirección extranjera
  // — decisión explícita: Module1 no lo captura, poco común fuera de EE.UU.
  // Line2g2_Province[0] ("State") queda vacío deliberadamente — [1] es
  // "Province", el concepto correcto para direcciones no estadounidenses.

  if (m1.willChangeStatusInUSA === true) {
    fv["form1[0].#subform[2].Line8a_StreetNumberName[0]"] = m1.beneficiaryUSStreetNumberName ?? "";
    fv["form1[0].#subform[2].Line6_AptSteFlrNumber[0]"] = m1.beneficiaryUSAptSteFlrNumber ?? "";
    fv["form1[0].#subform[2].Line8d_CityTown[0]"] = m1.beneficiaryUSCity ?? "";
    fv["form1[0].#subform[2].Line8e_State[0]"] = m1.beneficiaryUSState ?? "";
    fv["form1[0].#subform[2].Line8f_ZipCode[0]"] = m1.beneficiaryUSZipCode ?? "";

    if (m1.beneficiaryUSAptSteFlr === "APT") fv["form1[0].#subform[2].Line6_Unit[0]"] = "/1";
    if (m1.beneficiaryUSAptSteFlr === "FLR") fv["form1[0].#subform[2].Line6_Unit[1]"] = "/1";
    if (m1.beneficiaryUSAptSteFlr === "STE") fv["form1[0].#subform[2].Line6_Unit[2]"] = "/1";
  }

  fv["form1[0].#subform[33].a_O1A[0]"] = "/1";

  return fv;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const case_id: string | undefined = body.case_id;
    const submission_id: string | undefined = body.submission_id;

    if (!case_id) {
      return NextResponse.json({ error: "case_id is required" }, { status: 400 });
    }

    const db = adminDb();
    const subQuery = db.from("intake_submissions").select("*");
    const { data: submission, error: subErr } = submission_id
      ? await subQuery.eq("id", submission_id).maybeSingle()
      : await subQuery.eq("case_id", case_id).maybeSingle();

    if (subErr) throw new Error(`Error fetching submission: ${subErr.message}`);
    if (!submission) {
      return NextResponse.json({ error: "No intake submission found for this case." }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = submission as Record<string, any>;
    const m1 = sub.module1 ?? {};
    const m14 = sub.module14 ?? {};

    const fieldValues = buildI129FieldValues(m1, m14);

    const fillRes = await fetch(I129_FILL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldValues }),
    });

    if (!fillRes.ok) {
      const errorText = await fillRes.text();
      throw new Error(`i129_fill endpoint error ${fillRes.status}: ${errorText}`);
    }

    const pdfBuffer = Buffer.from(await fillRes.arrayBuffer());
    const uploadPath = `${case_id}/forms/i129/${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(uploadPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload I-129 PDF: ${uploadError.message}`);
    }

    const { data: draftRow, error: draftError } = await db
      .from("i129_form_drafts")
      .insert({
        case_id,
        docx_path: uploadPath,
        is_complete: false,
        notes: "Generado con mapeo parcial: Part 1 + nombre del beneficiario + checkbox O-1A + basis for classification. No es un I-129 completo — ver docs/i129-form-mapping/README.md.",
      })
      .select("id")
      .single();

    if (draftError || !draftRow) {
      throw new Error(`Failed to register I-129 draft: ${draftError?.message}`);
    }

    return NextResponse.json({
      case_id,
      draftId: draftRow.id,
      docxPath: uploadPath,
      isComplete: false,
      note: "Prueba de arquitectura — solo Part 1 + nombre del beneficiario + checkbox O-1A poblados. No es un I-129 completo.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
