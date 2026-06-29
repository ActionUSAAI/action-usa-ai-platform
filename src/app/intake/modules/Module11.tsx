import type { Module11, StrategicAnswer } from "../types";
import { Textarea, YesNo, InfoBox, FileUpload } from "../primitives";

type Props = { data: Module11; onChange: (d: Module11) => void; sessionId: string };

const QUESTIONS: { key: keyof Module11; question: string; hint: string }[] = [
  { key: "createdMethod",        question: "¿Ha creado algún método, proceso, herramienta, sistema o forma de trabajo que otras personas o empresas hayan utilizado?",       hint: "Metodologías propias, frameworks, sistemas que otros adoptaron..." },
  { key: "ledImpactProjects",    question: "¿Ha liderado proyectos que hayan tenido impacto significativo en su industria o comunidad?",                                     hint: "Proyectos con alcance más allá de su empresa o entorno inmediato..." },
  { key: "solvedComplexProblems",question: "¿Ha resuelto problemas complejos o poco comunes dentro de su campo profesional?",                                               hint: "Soluciones innovadoras, desafíos técnicos o artísticos difíciles..." },
  { key: "trainedProfessionals", question: "¿Ha capacitado o formado a otros profesionales en su área?",                                                                    hint: "Docencia, mentorías, talleres, entrenamientos corporativos..." },
  { key: "consultedForExpertise",question: "¿Ha sido consultado por su experiencia por otras empresas, instituciones o medios?",                                            hint: "Consultoría, asesoría, entrevistas como experto..." },
  { key: "evaluatedOthers",      question: "¿Ha evaluado el trabajo de otros profesionales (como jurado, revisor, comité, mentor)?",                                        hint: "Revisiones por pares, jurado en concursos, comités editoriales..." },
  { key: "workedForRecognized",  question: "¿Ha trabajado para empresas, instituciones o proyectos ampliamente reconocidos en su industria?",                               hint: "Marcas líderes, instituciones de renombre, proyectos icónicos..." },
  { key: "aboveAverageIncome",   question: "¿Sus ingresos han sido superiores al promedio de su campo o país?",                                                             hint: "Honorarios, salarios o contratos que superen el estándar del sector..." },
  { key: "willingToConfirm",     question: "¿Existen personas dispuestas a confirmar públicamente su impacto profesional?",                                                 hint: "Colegas, clientes, supervisores que firmarían cartas de soporte..." },
  { key: "additionalInfo",       question: "¿Hay algo más relevante sobre su trayectoria que no hayamos preguntado?",                                                       hint: "Cualquier logro, situación o contexto que consideres importante..." },
];

export function Module11({ data: d, onChange, sessionId }: Props) {
  const upd = (key: keyof Module11, patch: Partial<StrategicAnswer>) =>
    onChange({ ...d, [key]: { ...d[key], ...patch } });

  return (
    <div className="space-y-4">
      <InfoBox>
        Esta sección nos permite entender mejor tu impacto profesional.
        No hay respuestas correctas o incorrectas — sé tan específico/a como puedas.
      </InfoBox>

      {QUESTIONS.map(({ key, question, hint }) => (
        <div key={key} className="rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <p className="font-medium text-gray-800 leading-snug">{question}</p>
            <p className="mt-0.5 text-xs text-gray-400">{hint}</p>
          </div>
          <Textarea
            value={d[key].answer}
            onChange={v => upd(key, { answer: v })}
            placeholder="Describe específicamente cómo aplica a tu caso..."
            rows={3}
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">¿Tienes evidencia de esto?</span>
            <YesNo
              value={d[key].hasEvidence}
              onChange={v => upd(key, { hasEvidence: v })}
              yesLabel="Sí" noLabel="No"
            />
          </div>
          {d[key].hasEvidence === true && (
            <FileUpload
              sessionId={sessionId}
              storagePath={`module11/${key}`}
              filePath={d[key].filePath}
              fileName={d[key].fileName}
              onChange={({ filePath, fileName }) => upd(key, { filePath, fileName })}
            />
          )}
        </div>
      ))}
    </div>
  );
}
