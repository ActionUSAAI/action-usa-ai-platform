import type { Module12 } from "../types";

type Props = { data: Module12; onChange: (d: Module12) => void };

const OPTIONS = [
  {
    value: "si",
    label: "Sí, deseo que evalúen esta posibilidad",
    desc: "Un especialista revisará tu caso y te contactará para explorar estrategias legítimas.",
    cls: "border-brand-blue bg-brand-blue/5 text-brand-blue",
    selected: "border-brand-blue bg-brand-blue text-white",
  },
  {
    value: "tal_vez",
    label: "Tal vez más adelante",
    desc: "Puedes retomar esta opción desde tu portal de cliente cuando quieras.",
    cls: "border-amber-400 bg-amber-50 text-amber-700",
    selected: "border-amber-500 bg-amber-500 text-white",
  },
  {
    value: "no",
    label: "No por ahora",
    desc: "Continuaremos con la evidencia existente. Siempre puedes cambiar tu decisión.",
    cls: "border-gray-200 bg-gray-50 text-gray-600",
    selected: "border-gray-400 bg-gray-400 text-white",
  },
];

export function Module12({ data: d, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-5 space-y-3">
        <p className="font-semibold text-brand-blue">Evaluación de estrategias de posicionamiento</p>
        <p className="text-sm text-gray-700">
          Hemos identificado que algunas categorías de tu caso podrían fortalecerse.
          ACTION USA puede evaluar si existen estrategias legítimas de posicionamiento
          profesional para desarrollar evidencia adicional real y documentable.
        </p>
        <p className="text-sm text-gray-700">
          Esta evaluación es <strong>completamente gratuita</strong>, no implica ningún
          compromiso y únicamente nos permite determinar si existen oportunidades reales
          para tu caso.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ interest: opt.value })}
            className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
              d.interest === opt.value ? opt.selected : `${opt.cls} hover:opacity-80`
            }`}
          >
            <p className="font-semibold text-sm">{opt.label}</p>
            <p className={`mt-0.5 text-xs ${d.interest === opt.value ? "opacity-90" : "opacity-70"}`}>
              {opt.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
