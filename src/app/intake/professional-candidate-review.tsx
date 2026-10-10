"use client";

// AUSCIS Post-Module1 Professional Intelligence — Professional
// Candidate Review Surface (PI-C2). Purely presentational: receives
// the candidate overlay and two narrow callbacks, renders only
// "proposed" candidates grouped by domain, and emits exactly one
// onAccept/onReject call per beneficiary click.
//
// PI-C2 implements only:
//   candidate overlay -> beneficiary-readable presentation -> Accept/Reject event emission
// It does NOT know the beneficiary's draft intake answers, their
// persisted/legacy field keys, the canonical-to-legacy numbering
// translation, draft persistence, submission, the governed-knowledge
// review subsystem, the Structured Profile acquisition layer, or the
// prior slice's pure translation functions -- none of those are
// imported here. A future later slice owns what the emitted events do.
//
// rawText is never rendered (frozen architecture: it is the
// acquisition mechanism's own returned representation, not a
// guaranteed verbatim source span). Confidence is shown as neutral
// wording only and never gates/auto-triggers either action.

import { InfoBox } from "./primitives";
import type {
  ProfessionalIntelligenceCandidates,
  ProfessionalIntelligenceCandidate,
  EmploymentCandidate, EducationCandidate, CertificationCandidate,
  BusinessCandidate, ReferenceCandidate, EvidenceCandidate, StrategicAnswerCandidate,
  CandidateProvenance, CandidateConfidence, EvidenceCandidateCategory,
  StrategicAnswerTargetField,
  ProfessionalIntelligenceEnrichments, EmploymentEnrichment,
} from "@/lib/intake/professional-intelligence";

export type ProfessionalIntelligenceCandidateDomain = ProfessionalIntelligenceCandidate["domain"];

export type ProfessionalCandidateReviewProps = {
  candidates: ProfessionalIntelligenceCandidates;
  // PI-D0B: a separate, additive overlay -- never merged into
  // `candidates`. Only Employment enrichments exist in V1; the base
  // professional fact each one targets is resolved from `candidates`
  // by target.candidateId, never duplicated/snapshotted here.
  enrichments: ProfessionalIntelligenceEnrichments;
  onAccept: (domain: ProfessionalIntelligenceCandidateDomain, candidateId: string) => void;
  onReject: (domain: ProfessionalIntelligenceCandidateDomain, candidateId: string) => void;
  onAcceptEnrichment: (enrichmentId: string) => void;
  onRejectEnrichment: (enrichmentId: string) => void;
};

const DOMAIN_LABELS: Record<ProfessionalIntelligenceCandidateDomain, string> = {
  employment: "Experiencia profesional",
  education: "Educación",
  certification: "Cursos y certificaciones",
  business: "Empresas propias",
  reference: "Referencias profesionales",
  evidence: "Posible evidencia",
  strategicAnswer: "Información estratégica",
};

const EVIDENCE_CATEGORY_LABELS: Record<EvidenceCandidateCategory, string> = {
  awards: "Premios o reconocimientos",
  memberships: "Membresías",
  media: "Publicaciones o apariciones en medios",
  judging: "Participación como juez o evaluador",
  criticalRole: "Rol crítico o esencial",
  artisticExhibitions: "Exhibiciones o muestras artísticas",
};

// Short, faithful restatements of Module10.tsx's own existing
// beneficiary-facing question wording -- not new legal interpretation.
const STRATEGIC_FIELD_LABELS: Record<StrategicAnswerTargetField, string> = {
  createdMethod: "Método o proceso propio que otros usaron",
  ledImpactProjects: "Proyectos con impacto significativo",
  solvedComplexProblems: "Problemas complejos resueltos",
  trainedProfessionals: "Capacitación a otros profesionales",
  consultedForExpertise: "Consultas por tu experiencia",
  evaluatedOthers: "Evaluación del trabajo de otros",
  workedForRecognized: "Trabajo para organizaciones reconocidas",
  aboveAverageIncome: "Ingresos superiores al promedio",
  willingToConfirm: "Personas dispuestas a confirmar tu impacto",
  additionalInfo: "Información adicional relevante",
};

const CONFIDENCE_LABELS: Record<CandidateConfidence, string> = {
  high: "Confianza alta",
  medium: "Confianza media",
  low: "Confianza baja",
};

const CONFIDENCE_RANK: Record<CandidateConfidence, number> = { high: 2, medium: 1, low: 0 };

function highestConfidence(provenance: readonly CandidateProvenance[]): CandidateConfidence | null {
  if (provenance.length === 0) return null;
  return provenance.reduce<CandidateConfidence>(
    (best, p) => (CONFIDENCE_RANK[p.confidence] > CONFIDENCE_RANK[best] ? p.confidence : best),
    provenance[0].confidence
  );
}

function sourceLabel(provenance: readonly CandidateProvenance[]): string | null {
  const hasCv = provenance.some(p => p.source === "cv_extraction");
  const hasCoach = provenance.some(p => p.source === "coach_discovery");
  if (hasCv && hasCoach) return "Identificado en tu información";
  if (hasCv) return "Detectado en tu CV";
  if (hasCoach) return "Identificado durante la conversación";
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 italic">{children}</p>;
}

function Meta({ provenance }: { provenance: readonly CandidateProvenance[] }) {
  const source = sourceLabel(provenance);
  const confidence = highestConfidence(provenance);
  if (!source && !confidence) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
      {source && <span>{source}</span>}
      {source && confidence && <span>·</span>}
      {confidence && <span>{CONFIDENCE_LABELS[confidence]}</span>}
    </div>
  );
}

function ProposalCard({
  domain, title, children, provenance, onAccept, onReject,
}: {
  domain: ProfessionalIntelligenceCandidateDomain;
  title: string;
  children: React.ReactNode;
  provenance: readonly CandidateProvenance[];
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <Meta provenance={provenance}/>
      </div>
      <div className="space-y-2">{children}</div>
      <div className="flex gap-2 pt-1">
        <button
          type="button" onClick={onAccept}
          aria-label={`Aceptar propuesta de ${DOMAIN_LABELS[domain].toLowerCase()}`}
          className="flex-1 rounded-lg border-2 border-green-500 bg-green-500 py-2 text-sm font-medium text-white transition-all hover:bg-green-600"
        >
          Aceptar
        </button>
        <button
          type="button" onClick={onReject}
          aria-label={`Descartar propuesta de ${DOMAIN_LABELS[domain].toLowerCase()}`}
          className="flex-1 rounded-lg border-2 border-gray-200 py-2 text-sm font-medium text-gray-600 transition-all hover:border-gray-300"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

function EmploymentCard({ candidate, onAccept, onReject }: {
  candidate: EmploymentCandidate; onAccept: () => void; onReject: () => void;
}) {
  return (
    <ProposalCard domain="employment" title={candidate.company || candidate.title || "Experiencia laboral"}
      provenance={candidate.provenance} onAccept={onAccept} onReject={onReject}>
      <Row label="Empresa" value={candidate.company}/>
      <Row label="Cargo" value={candidate.title}/>
      <Row label="Fecha de inicio" value={candidate.startDate}/>
      {/* PI-D2-R1: explicit current-employment confirmation renders
          "Actual" regardless of the (always-blank) endDate string --
          never inferred from a blank endDate alone. Unknown (blank
          endDate, no explicit confirmation) continues to render no row
          at all via Row's own existing blank-value behavior. */}
      {candidate.currentEmployment === true
        ? <Row label="Fecha de finalización" value="Actual"/>
        : <Row label="Fecha de finalización" value={candidate.endDate}/>}
      <Row label="Funciones principales" value={candidate.mainFunctions}/>
      <Row label="Proyectos importantes" value={candidate.importantProjects}/>
      <Row label="Logros principales" value={candidate.mainAchievements}/>
    </ProposalCard>
  );
}

function EducationCard({ candidate, onAccept, onReject }: {
  candidate: EducationCandidate; onAccept: () => void; onReject: () => void;
}) {
  return (
    <ProposalCard domain="education" title={candidate.institution || candidate.degreeName || "Educación"}
      provenance={candidate.provenance} onAccept={onAccept} onReject={onReject}>
      <Row label="Institución" value={candidate.institution}/>
      <Row label="Título / Carrera" value={candidate.degreeName}/>
      <Row label="Año de graduación" value={candidate.graduationYear}/>
    </ProposalCard>
  );
}

function CertificationCard({ candidate, onAccept, onReject }: {
  candidate: CertificationCandidate; onAccept: () => void; onReject: () => void;
}) {
  return (
    <ProposalCard domain="certification" title={candidate.name || "Certificación"}
      provenance={candidate.provenance} onAccept={onAccept} onReject={onReject}>
      <Row label="Nombre" value={candidate.name}/>
      <Row label="Institución" value={candidate.institution}/>
      <Row label="Año" value={candidate.year}/>
    </ProposalCard>
  );
}

function BusinessCard({ candidate, onAccept, onReject }: {
  candidate: BusinessCandidate; onAccept: () => void; onReject: () => void;
}) {
  return (
    <ProposalCard domain="business" title={candidate.name || "Empresa propia"}
      provenance={candidate.provenance} onAccept={onAccept} onReject={onReject}>
      <Row label="Nombre de la empresa" value={candidate.name}/>
      <Row label="Año de fundación" value={candidate.foundedYear}/>
      {candidate.role.trim() && <Hint>Rol detectado: {candidate.role}</Hint>}
    </ProposalCard>
  );
}

function ReferenceCard({ candidate, onAccept, onReject }: {
  candidate: ReferenceCandidate; onAccept: () => void; onReject: () => void;
}) {
  return (
    <ProposalCard domain="reference" title={candidate.name || "Referencia profesional"}
      provenance={candidate.provenance} onAccept={onAccept} onReject={onReject}>
      <Row label="Nombre" value={candidate.name}/>
      <Row label="Logros que podría confirmar" value={candidate.specificAchievements}/>
      {candidate.relationshipType.trim() && <Hint>Relación detectada: {candidate.relationshipType}</Hint>}
    </ProposalCard>
  );
}

function EvidenceCard({ candidate, onAccept, onReject }: {
  candidate: EvidenceCandidate; onAccept: () => void; onReject: () => void;
}) {
  const label = EVIDENCE_CATEGORY_LABELS[candidate.category];
  return (
    <ProposalCard domain="evidence" title={label}
      provenance={candidate.provenance} onAccept={onAccept} onReject={onReject}>
      <p className="text-sm text-gray-800">
        Se detectó información que podría estar relacionada con esta categoría de evidencia.
      </p>
    </ProposalCard>
  );
}

function StrategicAnswerCard({ candidate, onAccept, onReject }: {
  candidate: StrategicAnswerCandidate; onAccept: () => void; onReject: () => void;
}) {
  const label = STRATEGIC_FIELD_LABELS[candidate.targetField];
  return (
    <ProposalCard domain="strategicAnswer" title={label}
      provenance={candidate.provenance} onAccept={onAccept} onReject={onReject}>
      <Row label={label} value={candidate.answer}/>
    </ProposalCard>
  );
}

// PI-D0B — Employment enrichment proposal card. One EmploymentEnrichment
// is one review unit: Accept/Reject applies to the entire proposal, never
// per-field (no field-level statuses, no splitting). Shows the base
// professional fact (company/title, resolved by id -- never duplicated
// into the enrichment itself), the beneficiary's own current-turn
// message (enrichment provenance rawText IS literally that message,
// per the frozen Coach provenance semantics -- unlike A0 candidate
// rawText, showing it here is accurate, not an exact-quote overclaim),
// and only the populated patch fields, each with a clear label. No
// editing, no per-field action, no module-jump shortcut, no navigation.
function EnrichmentCard({
  baseCandidate, enrichment, onAccept, onReject,
}: {
  baseCandidate: EmploymentCandidate;
  enrichment: EmploymentEnrichment;
  onAccept: () => void;
  onReject: () => void;
}) {
  const title = baseCandidate.company || baseCandidate.title || "Experiencia laboral";
  const rawText = enrichment.provenance[0]?.rawText ?? "";
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-gray-500">Información adicional sobre</p>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {baseCandidate.company && baseCandidate.title && (
          <p className="text-xs text-gray-500">{baseCandidate.title}</p>
        )}
        <Meta provenance={enrichment.provenance}/>
      </div>
      <div className="space-y-2">
        <Row label="Mencionaste" value={rawText}/>
        <Row label="Funciones principales" value={enrichment.patch.mainFunctions ?? ""}/>
        <Row label="Proyectos importantes" value={enrichment.patch.importantProjects ?? ""}/>
        <Row label="Logros principales" value={enrichment.patch.mainAchievements ?? ""}/>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button" onClick={onAccept}
          aria-label="Aceptar información adicional de experiencia profesional"
          className="flex-1 rounded-lg border-2 border-green-500 bg-green-500 py-2 text-sm font-medium text-white transition-all hover:bg-green-600"
        >
          Aceptar
        </button>
        <button
          type="button" onClick={onReject}
          aria-label="Descartar información adicional de experiencia profesional"
          className="flex-1 rounded-lg border-2 border-gray-200 py-2 text-sm font-medium text-gray-600 transition-all hover:border-gray-300"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

export function ProfessionalCandidateReview({ candidates, enrichments, onAccept, onReject, onAcceptEnrichment, onRejectEnrichment }: ProfessionalCandidateReviewProps) {
  const employment     = candidates.employment.filter(c => c.status === "proposed");
  const education       = candidates.education.filter(c => c.status === "proposed");
  const certification   = candidates.certification.filter(c => c.status === "proposed");
  const business        = candidates.business.filter(c => c.status === "proposed");
  const reference       = candidates.reference.filter(c => c.status === "proposed");
  const evidence        = candidates.evidence.filter(c => c.status === "proposed");
  const strategicAnswer = candidates.strategicAnswer.filter(c => c.status === "proposed");

  // PI-D0B: only "proposed" enrichments are ever actionable/rendered
  // (mirrors the candidate sections' own established rule exactly) --
  // accepted/rejected enrichments simply never appear here. An
  // enrichment whose exact target candidateId cannot be resolved is
  // never rendered as actionable (orphan cleanup is IntakeForm's
  // responsibility, not this component's; this is a defensive filter,
  // not the primary cleanup mechanism).
  const proposedEnrichments = enrichments.employment
    .filter(e => e.status === "proposed")
    .map(e => ({ enrichment: e, base: candidates.employment.find(c => c.id === e.target.candidateId) }))
    .filter((x): x is { enrichment: EmploymentEnrichment; base: EmploymentCandidate } => x.base !== undefined);

  const total = employment.length + education.length + certification.length + business.length
    + reference.length + evidence.length + strategicAnswer.length + proposedEnrichments.length;

  if (total === 0) return null;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-brand-blue">Información profesional detectada</h3>
        <p className="mt-1 text-xs text-gray-500">
          Encontramos información profesional que puede ayudarte a completar tu expediente.
          Revisa cada propuesta y decide si deseas agregarla.
        </p>
      </div>

      <InfoBox variant="amber">
        Estas son propuestas basadas en la información analizada. Revísalas antes de agregarlas a tu formulario.
      </InfoBox>

      {employment.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{DOMAIN_LABELS.employment}</p>
          <div className="space-y-2">
            {employment.map(c => (
              <EmploymentCard key={c.id} candidate={c} onAccept={() => onAccept("employment", c.id)} onReject={() => onReject("employment", c.id)}/>
            ))}
          </div>
        </div>
      )}

      {education.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{DOMAIN_LABELS.education}</p>
          <div className="space-y-2">
            {education.map(c => (
              <EducationCard key={c.id} candidate={c} onAccept={() => onAccept("education", c.id)} onReject={() => onReject("education", c.id)}/>
            ))}
          </div>
        </div>
      )}

      {certification.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{DOMAIN_LABELS.certification}</p>
          <div className="space-y-2">
            {certification.map(c => (
              <CertificationCard key={c.id} candidate={c} onAccept={() => onAccept("certification", c.id)} onReject={() => onReject("certification", c.id)}/>
            ))}
          </div>
        </div>
      )}

      {business.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{DOMAIN_LABELS.business}</p>
          <div className="space-y-2">
            {business.map(c => (
              <BusinessCard key={c.id} candidate={c} onAccept={() => onAccept("business", c.id)} onReject={() => onReject("business", c.id)}/>
            ))}
          </div>
        </div>
      )}

      {reference.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{DOMAIN_LABELS.reference}</p>
          <div className="space-y-2">
            {reference.map(c => (
              <ReferenceCard key={c.id} candidate={c} onAccept={() => onAccept("reference", c.id)} onReject={() => onReject("reference", c.id)}/>
            ))}
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{DOMAIN_LABELS.evidence}</p>
          <div className="space-y-2">
            {evidence.map(c => (
              <EvidenceCard key={c.id} candidate={c} onAccept={() => onAccept("evidence", c.id)} onReject={() => onReject("evidence", c.id)}/>
            ))}
          </div>
        </div>
      )}

      {strategicAnswer.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{DOMAIN_LABELS.strategicAnswer}</p>
          <div className="space-y-2">
            {strategicAnswer.map(c => (
              <StrategicAnswerCard key={c.id} candidate={c} onAccept={() => onAccept("strategicAnswer", c.id)} onReject={() => onReject("strategicAnswer", c.id)}/>
            ))}
          </div>
        </div>
      )}

      {/* PI-D0B: clearly distinct section -- never interleaved with the
          discovery candidate sections above, never changing their
          Accept/Reject semantics. */}
      {proposedEnrichments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Información adicional sobre experiencia profesional</p>
          <div className="space-y-2">
            {proposedEnrichments.map(({ enrichment, base }) => (
              <EnrichmentCard
                key={enrichment.id}
                baseCandidate={base}
                enrichment={enrichment}
                onAccept={() => onAcceptEnrichment(enrichment.id)}
                onReject={() => onRejectEnrichment(enrichment.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
