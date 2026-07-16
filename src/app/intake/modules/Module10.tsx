import type {
  Module10, EvidenceStatus, IncomeEvidence,
  AwardEvidence, MembershipEvidence, MediaEvidence, ArticleEvidence,
  BookEvidence, ConferenceEvidence, JudgingEvidence, PatentEvidence,
  ArtisticExhibitionEvidence, PerformingArtsCommercialSuccessEvidence,
  LeadStarringRoleEvidence, CriticalReviewEvidence, CriticalRoleOrgEvidence,
  CommercialSuccessEvidence, SignificantRecognitionEvidence,
  CriticalRoleEvidence,
} from "../types";
import {
  Field, TextInput, Textarea, Select, YesNo,
  AddBtn, Card, EvidenceSelector, SectionDivider, InfoBox, FileUpload, DispositionBox,
} from "../primitives";

type Props = { data: Module10; onChange: (d: Module10) => void; sessionId: string };

const genId = () => Math.random().toString(36).slice(2,9);

function EvidenceSection<T extends { id: string }>({
  title, status, onStatus, items, onItems, emptyItem,
  disposition, onDisposition,
  sessionId, sectionKey, strategyContent, children,
}: {
  title: string;
  status: EvidenceStatus; onStatus: (s: EvidenceStatus) => void;
  items: T[]; onItems: (items: T[]) => void;
  emptyItem: () => T;
  disposition: string; onDisposition: (v: string) => void;
  sessionId: string;
  sectionKey: string;
  strategyContent?: React.ReactNode;
  children: (item: T, index: number, update: <K extends keyof T>(f: K, v: T[K]) => void) => React.ReactNode;
}) {
  const addItem = () => onItems([...items, emptyItem()]);
  const removeItem = (i: number) => onItems(items.filter((_,idx) => idx !== i));
  const updItem = <K extends keyof T>(i: number, f: K, v: T[K]) => {
    const arr = [...items]; arr[i] = { ...arr[i], [f]: v }; onItems(arr);
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-4">
      <div>
        <p className="font-semibold text-gray-800">{title}</p>
        <div className="mt-2">
          <EvidenceSelector value={status} onChange={s => {
            onStatus(s);
            if (s === "tengo" && items.length === 0) onItems([emptyItem()]);
          }}/>
        </div>
      </div>
      {status === "tengo" && (
        <div className="space-y-3">
          {items.map((item, i) => (
            <Card key={item.id} label={title.split(" ")[0]} index={i}
              onRemove={items.length > 1 ? () => removeItem(i) : undefined}>
              {children(item, i, (f, v) => updItem(i, f, v))}
              <div className="mt-3">
                <FileUpload
                  sessionId={sessionId}
                  storagePath={`module10/${sectionKey}/${item.id}`}
                  filePath={(item as { filePath?: string }).filePath ?? ""}
                  fileName={(item as { fileName?: string }).fileName ?? ""}
                  onChange={({ filePath, fileName }) => {
                    updItem(i, "filePath" as keyof T, filePath as T[keyof T]);
                    updItem(i, "fileName" as keyof T, fileName as T[keyof T]);
                  }}
                />
              </div>
            </Card>
          ))}
          <AddBtn label={`Agregar ${title.toLowerCase()}`} onClick={addItem}/>
        </div>
      )}
      {status === "no_tengo" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
          {strategyContent ?? (
            <DispositionBox value={disposition} onChange={onDisposition} label={title.toLowerCase()}/>
          )}
        </div>
      )}
    </div>
  );
}

export function Module10({ data: d, onChange, sessionId }: Props) {
  const u = <K extends keyof Module10>(f: K, v: Module10[K]) => onChange({ ...d, [f]: v });
  const uIncome = (patch: Partial<IncomeEvidence>) => u("incomeEvidence", { ...d.incomeEvidence, ...patch });

  return (
    <div className="space-y-4">
      <InfoBox>
        Comparte solo lo que ya tienes. No es necesario que sea perfecto ni completo.
        Puedes agregar evidencia adicional desde tu portal en cualquier momento.
      </InfoBox>

      {/* A — Awards */}
      <EvidenceSection
        title="Premios y reconocimientos"
        status={d.awardsStatus} onStatus={s => u("awardsStatus", s)}
        items={d.awards} onItems={v => u("awards", v)}
        disposition={d.awardsDisposition} onDisposition={v => u("awardsDisposition", v)}
        emptyItem={() => ({ id:genId(), name:"", org:"", year:"", country:"", description:"", link:"", awardNominationAndJudgingCriteria:"", panelOrOrgReputationEvidence:"", awardFrequencyAndScope:"", filePath:"", fileName:"" } as AwardEvidence)}
        sessionId={sessionId} sectionKey="awards"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿En qué área te gustaría ser reconocido/a? ¿Hay alguna competencia o convocatoria de tu industria que conozcas?">
            <Textarea value={d.awardsDisposition} onChange={v => u("awardsDisposition", v)}
              placeholder="Ej: Me interesa el área de innovación en salud digital. Conozco el premio X de la organización Y..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre del premio"><TextInput value={item.name} onChange={v=>upd("name",v)} placeholder="Oscar, Grammy..."/></Field>
            <Field label="Organización"><TextInput value={item.org} onChange={v=>upd("org",v)} placeholder="Academy of Motion Picture Arts..."/></Field>
            <Field label="Año"><TextInput type="number" value={item.year} onChange={v=>upd("year",v)} placeholder="2022"/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA"/></Field>
            <Field label="Descripción breve"><TextInput value={item.description} onChange={v=>upd("description",v)} placeholder="Premio al mejor..."/></Field>
            <Field label="Link" hint="Opcional"><TextInput value={item.link} onChange={v=>upd("link",v)} placeholder="https://..."/></Field>
            <Field label="Criterio de nominación y juzgamiento" hint="¿Cómo se nomina y evalúa a los candidatos?">
              <Textarea value={item.awardNominationAndJudgingCriteria} onChange={v=>upd("awardNominationAndJudgingCriteria",v)} placeholder="Los candidatos son nominados por pares, evaluados por un panel de..."/>
            </Field>
            <Field label="Reputación del panel u organización" hint="Afiliaciones, reconocimiento cruzado por otras asociaciones">
              <Textarea value={item.panelOrOrgReputationEvidence} onChange={v=>upd("panelOrOrgReputationEvidence",v)} placeholder="El panel está compuesto por expertos de..., la organización es reconocida por..."/>
            </Field>
            <Field label="Frecuencia y alcance del premio" hint="¿Cuántos se otorgan al año? ¿Alcance nacional/internacional?">
              <Textarea value={item.awardFrequencyAndScope} onChange={v=>upd("awardFrequencyAndScope",v)} placeholder="Se otorga anualmente a nivel nacional, con un solo ganador por categoría..."/>
            </Field>
          </div>
        )}
      </EvidenceSection>

      {/* B — Memberships */}
      <EvidenceSection
        title="Membresías en asociaciones"
        status={d.membershipsStatus} onStatus={s => u("membershipsStatus", s)}
        items={d.memberships} onItems={v => u("memberships", v)}
        disposition={d.membershipsDisposition} onDisposition={v => u("membershipsDisposition", v)}
        emptyItem={() => ({ id:genId(), orgName:"", country:"", yearJoined:"", requiredEval:null, filePath:"", fileName:"" } as MembershipEvidence)}
        sessionId={sessionId} sectionKey="memberships"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿A qué asociaciones profesionales de tu industria pertenecen los líderes de tu campo?">
            <Textarea value={d.membershipsDisposition} onChange={v => u("membershipsDisposition", v)}
              placeholder="Ej: En mi área los referentes pertenecen a la Society of Motion Picture Engineers, IEEE..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre de la asociación"><TextInput value={item.orgName} onChange={v=>upd("orgName",v)} placeholder="Directors Guild, Academy of Sciences..."/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA"/></Field>
            <Field label="Año de ingreso"><TextInput type="number" value={item.yearJoined} onChange={v=>upd("yearJoined",v)} placeholder="2019"/></Field>
            <Field label="¿Requirió evaluación o selección para ingresar?">
              <YesNo value={item.requiredEval} onChange={v=>upd("requiredEval",v)} yesLabel="Sí" noLabel="No"/>
            </Field>
          </div>
        )}
      </EvidenceSection>

      {/* C — Media */}
      <EvidenceSection
        title="Cobertura en medios"
        status={d.mediaStatus} onStatus={s => u("mediaStatus", s)}
        items={d.media} onItems={v => u("media", v)}
        disposition={d.mediaDisposition} onDisposition={v => u("mediaDisposition", v)}
        emptyItem={() => ({ id:genId(), medium:"", title:"", date:"", author:"", link:"", reach:"", filePath:"", fileName:"" } as MediaEvidence)}
        sessionId={sessionId} sectionKey="media"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Sobre qué logro o proyecto tuyo te gustaría que escribiera un medio especializado?">
            <Textarea value={d.mediaDisposition} onChange={v => u("mediaDisposition", v)}
              placeholder="Ej: Mi trabajo en el proyecto X redujo costos hospitalarios en un 40%..."/>
          </Field>
          <Field label="¿Tienes página web o presencia online profesional?" hint="Opcional">
            <YesNo value={d.hasWebsite} onChange={v => u("hasWebsite", v)} yesLabel="Sí" noLabel="No"/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Medio / Publicación"><TextInput value={item.medium} onChange={v=>upd("medium",v)} placeholder="The New York Times, Variety..."/></Field>
            <Field label="Título del artículo"><TextInput value={item.title} onChange={v=>upd("title",v)} placeholder="El director que revolucionó..."/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
            <Field label="Autor" hint="Opcional"><TextInput value={item.author} onChange={v=>upd("author",v)} placeholder="Jane Smith"/></Field>
            <Field label="Alcance">
              <Select value={item.reach} onChange={v=>upd("reach",v)}>
                <option value="">Selecciona...</option>
                <option value="local">Local</option>
                <option value="nacional">Nacional</option>
                <option value="internacional">Internacional</option>
              </Select>
            </Field>
            <Field label="Link" hint="Opcional"><TextInput value={item.link} onChange={v=>upd("link",v)} placeholder="https://..."/></Field>
          </div>
        )}
      </EvidenceSection>

      {/* D — Articles */}
      <EvidenceSection
        title="Artículos escritos"
        status={d.articlesStatus} onStatus={s => u("articlesStatus", s)}
        items={d.articles} onItems={v => u("articles", v)}
        disposition={d.articlesDisposition} onDisposition={v => u("articlesDisposition", v)}
        emptyItem={() => ({ id:genId(), title:"", publication:"", date:"", link:"", filePath:"", fileName:"" } as ArticleEvidence)}
        sessionId={sessionId} sectionKey="articles"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Sobre qué tema de tu especialidad te gustaría escribir un artículo académico o de opinión? ¿En qué publicación te gustaría aparecer?">
            <Textarea value={d.articlesDisposition} onChange={v => u("articlesDisposition", v)}
              placeholder="Ej: Me gustaría escribir sobre IA aplicada a diagnóstico clínico en The Lancet o Nature Medicine..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Título"><TextInput value={item.title} onChange={v=>upd("title",v)} placeholder="Machine Learning in Radiology..."/></Field>
            <Field label="Revista / Publicación"><TextInput value={item.publication} onChange={v=>upd("publication",v)} placeholder="Nature, The Lancet, IEEE..."/></Field>
            <Field label="Fecha"><TextInput type="month" value={item.date} onChange={v=>upd("date",v)}/></Field>
            <Field label="Link / DOI" hint="Opcional"><TextInput value={item.link} onChange={v=>upd("link",v)} placeholder="https://doi.org/..."/></Field>
          </div>
        )}
      </EvidenceSection>

      {/* E — Books */}
      <EvidenceSection
        title="Libros publicados"
        status={d.booksStatus} onStatus={s => u("booksStatus", s)}
        items={d.books} onItems={v => u("books", v)}
        disposition={d.booksDisposition} onDisposition={v => u("booksDisposition", v)}
        emptyItem={() => ({ id:genId(), title:"", publisher:"", year:"", isbn:"", link:"", filePath:"", fileName:"" } as BookEvidence)}
        sessionId={sessionId} sectionKey="books"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Sobre qué tema te gustaría publicar un libro? ¿Tienes algún manuscrito o idea desarrollada?">
            <Textarea value={d.booksDisposition} onChange={v => u("booksDisposition", v)}
              placeholder="Ej: Tengo un manuscrito sobre liderazgo en equipos de alta tecnología. Me interesa publicar con MIT Press..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Título"><TextInput value={item.title} onChange={v=>upd("title",v)} placeholder="Inteligencia Artificial Aplicada..."/></Field>
            <Field label="Editorial"><TextInput value={item.publisher} onChange={v=>upd("publisher",v)} placeholder="Penguin, MIT Press..."/></Field>
            <Field label="Año"><TextInput type="number" value={item.year} onChange={v=>upd("year",v)} placeholder="2021"/></Field>
            <Field label="ISBN" hint="Opcional"><TextInput value={item.isbn} onChange={v=>upd("isbn",v)} placeholder="978-..."/></Field>
            <Field label="Link" hint="Opcional"><TextInput value={item.link} onChange={v=>upd("link",v)} placeholder="https://..."/></Field>
          </div>
        )}
      </EvidenceSection>

      {/* F — Conferences */}
      <EvidenceSection
        title="Conferencias y ponencias"
        status={d.conferencesStatus} onStatus={s => u("conferencesStatus", s)}
        items={d.conferences} onItems={v => u("conferences", v)}
        disposition={d.conferencesDisposition} onDisposition={v => u("conferencesDisposition", v)}
        emptyItem={() => ({ id:genId(), event:"", org:"", country:"", date:"", topic:"", role:"", filePath:"", fileName:"" } as ConferenceEvidence)}
        sessionId={sessionId} sectionKey="conferences"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿En qué eventos o conferencias de tu industria te gustaría participar como ponente? ¿Sobre qué tema hablarías?">
            <Textarea value={d.conferencesDisposition} onChange={v => u("conferencesDisposition", v)}
              placeholder="Ej: Me interesa hablar en TEDx o en el congreso anual de la IEEE sobre automatización industrial..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Evento / Conferencia"><TextInput value={item.event} onChange={v=>upd("event",v)} placeholder="TEDx, Sundance, IEEE Summit..."/></Field>
            <Field label="Organización"><TextInput value={item.org} onChange={v=>upd("org",v)} placeholder="TED, IEEE..."/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA"/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
            <Field label="Tema de la ponencia"><TextInput value={item.topic} onChange={v=>upd("topic",v)} placeholder="IA en medicina..."/></Field>
            <Field label="Rol">
              <Select value={item.role} onChange={v=>upd("role",v)}>
                <option value="">Selecciona...</option>
                <option value="ponente">Ponente / Speaker</option>
                <option value="invitado">Invitado especial</option>
                <option value="panelista">Panelista</option>
                <option value="organizador">Organizador</option>
              </Select>
            </Field>
          </div>
        )}
      </EvidenceSection>

      {/* G — Judging */}
      <EvidenceSection
        title="Juez o evaluador"
        status={d.judgingStatus} onStatus={s => u("judgingStatus", s)}
        items={d.judging} onItems={v => u("judging", v)}
        disposition={d.judgingDisposition} onDisposition={v => u("judgingDisposition", v)}
        emptyItem={() => ({ id:genId(), eventOrProcess:"", org:"", country:"", date:"", roleDescription:"", judgeSelectionCriteria:"", judgedEventSignificance:"", judgmentAuthorityAndConsequence:"", filePath:"", fileName:"" } as JudgingEvidence)}
        sessionId={sessionId} sectionKey="judging"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿En qué tipo de procesos de selección, jurados o comités de tu industria podrías participar como evaluador?">
            <Textarea value={d.judgingDisposition} onChange={v => u("judgingDisposition", v)}
              placeholder="Ej: Podría participar como jurado en competencias de startups de salud digital o en comités de becas universitarias..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Evento o proceso"><TextInput value={item.eventOrProcess} onChange={v=>upd("eventOrProcess",v)} placeholder="Festival de Cine, Comité de Becas..."/></Field>
            <Field label="Organización"><TextInput value={item.org} onChange={v=>upd("org",v)} placeholder="Sundance Institute..."/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA"/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
            <Field label="Descripción del rol" hint="¿Qué evaluabas?">
              <TextInput value={item.roleDescription} onChange={v=>upd("roleDescription",v)} placeholder="Evaluador de cortometrajes documentales..."/>
            </Field>
            <Field label="Criterio de selección" hint="¿Por qué te eligieron a ti específicamente?">
              <Textarea value={item.judgeSelectionCriteria} onChange={v=>upd("judgeSelectionCriteria",v)} placeholder="Fui invitado por mi experiencia en..., la organización buscaba expertos con..."/>
            </Field>
            <Field label="Significancia del evento juzgado" hint="Escala, nivel, relevancia del evento">
              <Textarea value={item.judgedEventSignificance} onChange={v=>upd("judgedEventSignificance",v)} placeholder="Competencia nacional con 200 participantes, evento anual de referencia en la industria..."/>
            </Field>
            <Field label="Autoridad y consecuencia del veredicto" hint="¿Tu decisión fue final/vinculante? ¿Qué consecuencia tuvo?">
              <Textarea value={item.judgmentAuthorityAndConsequence} onChange={v=>upd("judgmentAuthorityAndConsequence",v)} placeholder="Mi calificación determinó directamente el ganador, sin posibilidad de apelación..."/>
            </Field>
          </div>
        )}
      </EvidenceSection>

      {/* H — Patents */}
      <EvidenceSection
        title="Patentes o propiedad intelectual"
        status={d.patentsStatus} onStatus={s => u("patentsStatus", s)}
        items={d.patents} onItems={v => u("patents", v)}
        disposition={d.patentsDisposition} onDisposition={v => u("patentsDisposition", v)}
        emptyItem={() => ({ id:genId(), type:"", name:"", country:"", year:"", number:"", filePath:"", fileName:"" } as PatentEvidence)}
        sessionId={sessionId} sectionKey="patents"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Tienes alguna metodología, proceso o creación original que pudiera registrarse como propiedad intelectual?">
            <Textarea value={d.patentsDisposition} onChange={v => u("patentsDisposition", v)}
              placeholder="Ej: Desarrollé un protocolo quirúrgico propio que podría registrarse. También tengo un software de análisis de datos sin patentar..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tipo"><Select value={item.type} onChange={v=>upd("type",v)}>
              <option value="">Selecciona...</option>
              <option value="patente">Patente</option>
              <option value="marca">Marca registrada</option>
              <option value="derecho_autor">Derecho de autor</option>
              <option value="otro">Otro</option>
            </Select></Field>
            <Field label="Nombre / Descripción"><TextInput value={item.name} onChange={v=>upd("name",v)} placeholder="Sistema de detección automática..."/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA, Colombia..."/></Field>
            <Field label="Año"><TextInput type="number" value={item.year} onChange={v=>upd("year",v)} placeholder="2020"/></Field>
            <Field label="Número de registro" hint="Opcional"><TextInput value={item.number} onChange={v=>upd("number",v)} placeholder="US10,123,456"/></Field>
          </div>
        )}
      </EvidenceSection>

      <SectionDivider title="Evidencia adicional — EB-1A"/>

      {/* K — Artistic Exhibitions */}
      <EvidenceSection
        title="Exhibición de trabajo en muestras o exposiciones"
        status={d.artisticExhibitionsStatus} onStatus={s => u("artisticExhibitionsStatus", s)}
        items={d.artisticExhibitions} onItems={v => u("artisticExhibitions", v)}
        disposition={d.artisticExhibitionsDisposition} onDisposition={v => u("artisticExhibitionsDisposition", v)}
        emptyItem={() => ({ id:genId(), exhibitionName:"", venue:"", country:"", date:"", description:"", filePath:"", fileName:"" } as ArtisticExhibitionEvidence)}
        sessionId={sessionId} sectionKey="artisticExhibitions"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Has exhibido o te gustaría exhibir tu trabajo en alguna muestra, galería o exposición?">
            <Textarea value={d.artisticExhibitionsDisposition} onChange={v => u("artisticExhibitionsDisposition", v)}
              placeholder="Ej: Me gustaría exhibir mi trabajo en la galería X, o participé en una muestra colectiva en..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre de la exposición/muestra"><TextInput value={item.exhibitionName} onChange={v=>upd("exhibitionName",v)} placeholder="Bienal de Arte..."/></Field>
            <Field label="Lugar / Venue"><TextInput value={item.venue} onChange={v=>upd("venue",v)} placeholder="Museo de Arte Moderno..."/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA"/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
            <Field label="Descripción breve"><TextInput value={item.description} onChange={v=>upd("description",v)} placeholder="Obra exhibida, contexto..."/></Field>
          </div>
        )}
      </EvidenceSection>

      {/* L — Performing Arts Commercial Success */}
      <EvidenceSection
        title="Éxitos comerciales en las artes escénicas"
        status={d.performingArtsSuccessStatus} onStatus={s => u("performingArtsSuccessStatus", s)}
        items={d.performingArtsSuccess} onItems={v => u("performingArtsSuccess", v)}
        disposition={d.performingArtsSuccessDisposition} onDisposition={v => u("performingArtsSuccessDisposition", v)}
        emptyItem={() => ({ id:genId(), productionOrWorkTitle:"", successIndicator:"", figureOrMetric:"", source:"", date:"", filePath:"", fileName:"" } as PerformingArtsCommercialSuccessEvidence)}
        sessionId={sessionId} sectionKey="performingArtsSuccess"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Alguna producción o proyecto tuyo ha tenido éxito comercial medible (taquilla, ventas, audiencia)?">
            <Textarea value={d.performingArtsSuccessDisposition} onChange={v => u("performingArtsSuccessDisposition", v)}
              placeholder="Ej: Mi obra tuvo X funciones con Y espectadores, o mi álbum vendió Z copias..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Producción / Obra"><TextInput value={item.productionOrWorkTitle} onChange={v=>upd("productionOrWorkTitle",v)} placeholder="Nombre de la obra, álbum, gira..."/></Field>
            <Field label="Indicador de éxito"><TextInput value={item.successIndicator} onChange={v=>upd("successIndicator",v)} placeholder="Taquilla, ventas, audiencia..."/></Field>
            <Field label="Cifra / Métrica"><TextInput value={item.figureOrMetric} onChange={v=>upd("figureOrMetric",v)} placeholder="$500,000, 50,000 espectadores..."/></Field>
            <Field label="Fuente"><TextInput value={item.source} onChange={v=>upd("source",v)} placeholder="Reporte de la productora, Billboard..."/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
          </div>
        )}
      </EvidenceSection>

      <SectionDivider title="Evidencia — O-1B (Distinción en las Artes)"/>

      {/* M — Lead/Starring Role */}
      <EvidenceSection
        title="Rol principal o protagónico en producciones o eventos"
        status={d.leadStarringRoleStatus} onStatus={s => u("leadStarringRoleStatus", s)}
        items={d.leadStarringRole} onItems={v => u("leadStarringRole", v)}
        disposition={d.leadStarringRoleDisposition} onDisposition={v => u("leadStarringRoleDisposition", v)}
        emptyItem={() => ({ id:genId(), productionOrEventName:"", roleDescription:"", organization:"", date:"", reputationEvidence:"", filePath:"", fileName:"" } as LeadStarringRoleEvidence)}
        sessionId={sessionId} sectionKey="leadStarringRole"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Has tenido o te gustaría tener un rol protagónico en alguna producción o evento reconocido?">
            <Textarea value={d.leadStarringRoleDisposition} onChange={v => u("leadStarringRoleDisposition", v)}
              placeholder="Ej: Protagonicé la obra X en el teatro Y, o me gustaría el rol principal en..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Producción / Evento"><TextInput value={item.productionOrEventName} onChange={v=>upd("productionOrEventName",v)} placeholder="Nombre de la obra, película, evento..."/></Field>
            <Field label="Descripción del rol"><TextInput value={item.roleDescription} onChange={v=>upd("roleDescription",v)} placeholder="Protagonista, rol principal..."/></Field>
            <Field label="Organización / Productora"><TextInput value={item.organization} onChange={v=>upd("organization",v)} placeholder="Teatro Nacional, Studio X..."/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
            <Field label="Evidencia de reputación distinguida" hint="Reseñas, publicidad, taquilla que acrediten la reputación">
              <Textarea value={item.reputationEvidence} onChange={v=>upd("reputationEvidence",v)} placeholder="Reseñas críticas, cobertura de prensa, cifras de taquilla..."/>
            </Field>
          </div>
        )}
      </EvidenceSection>

      {/* N — Critical Reviews */}
      <EvidenceSection
        title="Reseñas críticas sobre tu trabajo"
        status={d.criticalReviewsStatus} onStatus={s => u("criticalReviewsStatus", s)}
        items={d.criticalReviews} onItems={v => u("criticalReviews", v)}
        disposition={d.criticalReviewsDisposition} onDisposition={v => u("criticalReviewsDisposition", v)}
        emptyItem={() => ({ id:genId(), publication:"", title:"", author:"", date:"", link:"", filePath:"", fileName:"" } as CriticalReviewEvidence)}
        sessionId={sessionId} sectionKey="criticalReviews"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Algún crítico o publicación especializada ha reseñado tu trabajo?">
            <Textarea value={d.criticalReviewsDisposition} onChange={v => u("criticalReviewsDisposition", v)}
              placeholder="Ej: Me gustaría que reseñaran mi trabajo en Variety, o fui reseñado en..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Publicación"><TextInput value={item.publication} onChange={v=>upd("publication",v)} placeholder="Variety, The Hollywood Reporter..."/></Field>
            <Field label="Título de la reseña"><TextInput value={item.title} onChange={v=>upd("title",v)} placeholder="Título del artículo..."/></Field>
            <Field label="Autor" hint="Opcional"><TextInput value={item.author} onChange={v=>upd("author",v)} placeholder="Jane Smith"/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
            <Field label="Link" hint="Opcional"><TextInput value={item.link} onChange={v=>upd("link",v)} placeholder="https://..."/></Field>
          </div>
        )}
      </EvidenceSection>

      {/* O — Critical Role in Organization */}
      <EvidenceSection
        title="Rol principal, protagónico o crítico en organización distinguida"
        status={d.criticalRoleOrgStatus} onStatus={s => u("criticalRoleOrgStatus", s)}
        items={d.criticalRoleOrg} onItems={v => u("criticalRoleOrg", v)}
        disposition={d.criticalRoleOrgDisposition} onDisposition={v => u("criticalRoleOrgDisposition", v)}
        emptyItem={() => ({ id:genId(), organization:"", roleTitle:"", country:"", startDate:"", endDate:"", reputationEvidence:"", filePath:"", fileName:"" } as CriticalRoleOrgEvidence)}
        sessionId={sessionId} sectionKey="criticalRoleOrg"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Has desempeñado un rol clave en alguna organización artística de reputación distinguida?">
            <Textarea value={d.criticalRoleOrgDisposition} onChange={v => u("criticalRoleOrgDisposition", v)}
              placeholder="Ej: Fui director artístico de la compañía X..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Organización"><TextInput value={item.organization} onChange={v=>upd("organization",v)} placeholder="Compañía de teatro, orquesta, estudio..."/></Field>
            <Field label="Cargo / Rol"><TextInput value={item.roleTitle} onChange={v=>upd("roleTitle",v)} placeholder="Director artístico, primer bailarín..."/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA"/></Field>
            <Field label="Fecha de inicio"><TextInput type="date" value={item.startDate} onChange={v=>upd("startDate",v)}/></Field>
            <Field label="Fecha de fin" hint="Deja en blanco si continúa"><TextInput type="date" value={item.endDate} onChange={v=>upd("endDate",v)}/></Field>
            <Field label="Evidencia de reputación distinguida de la organización">
              <Textarea value={item.reputationEvidence} onChange={v=>upd("reputationEvidence",v)} placeholder="Artículos, trayectoria, reconocimiento de la organización..."/>
            </Field>
          </div>
        )}
      </EvidenceSection>

      {/* P — Commercial Success */}
      <EvidenceSection
        title="Éxitos comerciales o de crítica"
        status={d.commercialSuccessStatus} onStatus={s => u("commercialSuccessStatus", s)}
        items={d.commercialSuccess} onItems={v => u("commercialSuccess", v)}
        disposition={d.commercialSuccessDisposition} onDisposition={v => u("commercialSuccessDisposition", v)}
        emptyItem={() => ({ id:genId(), productionOrWorkTitle:"", successIndicator:"", figureOrMetric:"", source:"", date:"", filePath:"", fileName:"" } as CommercialSuccessEvidence)}
        sessionId={sessionId} sectionKey="commercialSuccess"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Alguna de tus producciones ha tenido éxito comercial o de crítica destacable?">
            <Textarea value={d.commercialSuccessDisposition} onChange={v => u("commercialSuccessDisposition", v)}
              placeholder="Ej: Mi película tuvo X en taquilla, o recibió Y calificación en..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Producción / Obra"><TextInput value={item.productionOrWorkTitle} onChange={v=>upd("productionOrWorkTitle",v)} placeholder="Nombre de la producción..."/></Field>
            <Field label="Indicador de éxito"><TextInput value={item.successIndicator} onChange={v=>upd("successIndicator",v)} placeholder="Taquilla, rating, ventas..."/></Field>
            <Field label="Cifra / Métrica"><TextInput value={item.figureOrMetric} onChange={v=>upd("figureOrMetric",v)} placeholder="$1,000,000, 8.5/10..."/></Field>
            <Field label="Fuente"><TextInput value={item.source} onChange={v=>upd("source",v)} placeholder="Box Office Mojo, Rotten Tomatoes..."/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
          </div>
        )}
      </EvidenceSection>

      {/* Q — Significant Recognition */}
      <EvidenceSection
        title="Reconocimiento significativo de organizaciones, críticos o expertos"
        status={d.significantRecognitionStatus} onStatus={s => u("significantRecognitionStatus", s)}
        items={d.significantRecognition} onItems={v => u("significantRecognition", v)}
        disposition={d.significantRecognitionDisposition} onDisposition={v => u("significantRecognitionDisposition", v)}
        emptyItem={() => ({ id:genId(), recognizingParty:"", recognizingPartyCredentials:"", achievementRecognized:"", date:"", filePath:"", fileName:"" } as SignificantRecognitionEvidence)}
        sessionId={sessionId} sectionKey="significantRecognition"
        strategyContent={<>
          <p className="text-sm font-semibold text-amber-800">Construyamos este criterio</p>
          <Field label="¿Alguna organización, crítico o experto reconocido ha destacado tu trabajo?">
            <Textarea value={d.significantRecognitionDisposition} onChange={v => u("significantRecognitionDisposition", v)}
              placeholder="Ej: Me gustaría que un crítico reconocido de mi campo hablara de mi trabajo..."/>
          </Field>
        </>}
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Quién reconoce"><TextInput value={item.recognizingParty} onChange={v=>upd("recognizingParty",v)} placeholder="Organización, crítico, agencia gubernamental..."/></Field>
            <Field label="Credenciales de quien reconoce"><TextInput value={item.recognizingPartyCredentials} onChange={v=>upd("recognizingPartyCredentials",v)} placeholder="Crítico de cine en X, director de Y..."/></Field>
            <Field label="Logro reconocido"><Textarea value={item.achievementRecognized} onChange={v=>upd("achievementRecognized",v)} placeholder="Descripción del logro reconocido..."/></Field>
            <Field label="Fecha"><TextInput type="date" value={item.date} onChange={v=>upd("date",v)}/></Field>
          </div>
        )}
      </EvidenceSection>

      {/* R — Critical Role (4a/4b) */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900 mb-1">Rol crítico o esencial en organización distinguida</h3>
        <p className="text-sm text-gray-600 mb-3">¿Has desempeñado un cargo directivo/electo o técnico/instructor en una organización de reputación distinguida?</p>

        <Field label="¿Tienes este tipo de evidencia?">
          <Select
            value={d.criticalRole ? "si" : "no"}
            onChange={v => {
              if (v === "si" && !d.criticalRole) {
                u("criticalRole", { criticalRoleType: "elected", organizationName:"", electedOrAppointedTitle:"", tenureStartDate:"", tenureEndDate:null, organizationReputationEvidence:"", organizationalGrowthMetrics:"" } as CriticalRoleEvidence);
              } else if (v === "no") {
                u("criticalRole", undefined);
              }
            }}
          >
            <option value="no">No tengo</option>
            <option value="si">Sí tengo</option>
          </Select>
        </Field>

        {d.criticalRole && (() => {
          const cr = d.criticalRole!;
          return (
          <div className="mt-3 space-y-3">
            <Field label="Tipo de cargo">
              <Select
                value={cr.criticalRoleType}
                onChange={v => {
                  if (v === "elected") {
                    u("criticalRole", { criticalRoleType:"elected", organizationName:"", electedOrAppointedTitle:"", tenureStartDate:"", tenureEndDate:null, organizationReputationEvidence:"", organizationalGrowthMetrics:"" } as CriticalRoleEvidence);
                  } else {
                    u("criticalRole", { criticalRoleType:"technical", organizationName:"", formalPositionTitle:"", serviceStartDate:"", serviceEndDate:null, specificCoursesOrDutiesTaught:"", institutionalizationEvidence:"" } as CriticalRoleEvidence);
                  }
                }}
              >
                <option value="elected">Directivo / Electo</option>
                <option value="technical">Técnico / Instructor</option>
              </Select>
            </Field>

            {cr.criticalRoleType === "elected" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre de la organización"><TextInput value={cr.organizationName} onChange={v=>u("criticalRole",{...cr,organizationName:v})} placeholder="Federación Nacional de..., Cámara de..."/></Field>
                <Field label="Cargo (electo/designado)"><TextInput value={cr.electedOrAppointedTitle} onChange={v=>u("criticalRole",{...cr,electedOrAppointedTitle:v})} placeholder="Presidente, Director..."/></Field>
                <Field label="Inicio del período"><TextInput type="date" value={cr.tenureStartDate} onChange={v=>u("criticalRole",{...cr,tenureStartDate:v})}/></Field>
                <Field label="Fin del período" hint="Deja en blanco si continúa"><TextInput type="date" value={cr.tenureEndDate ?? ""} onChange={v=>u("criticalRole",{...cr,tenureEndDate:v || null})}/></Field>
                <Field label="Reputación de la organización"><Textarea value={cr.organizationReputationEvidence} onChange={v=>u("criticalRole",{...cr,organizationReputationEvidence:v})} placeholder="Trayectoria, reconocimiento de la organización..."/></Field>
                <Field label="Métricas de crecimiento durante tu gestión"><Textarea value={cr.organizationalGrowthMetrics} onChange={v=>u("criticalRole",{...cr,organizationalGrowthMetrics:v})} placeholder="Membresía, afiliaciones logradas, sistemas implementados..."/></Field>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre de la organización"><TextInput value={cr.organizationName} onChange={v=>u("criticalRole",{...cr,organizationName:v})} placeholder="Escuela de..., Academia..."/></Field>
                <Field label="Cargo (técnico/instructor)"><TextInput value={cr.formalPositionTitle} onChange={v=>u("criticalRole",{...cr,formalPositionTitle:v})} placeholder="Instructor, Entrenador..."/></Field>
                <Field label="Inicio del período"><TextInput type="date" value={cr.serviceStartDate} onChange={v=>u("criticalRole",{...cr,serviceStartDate:v})}/></Field>
                <Field label="Fin del período" hint="Deja en blanco si continúa"><TextInput type="date" value={cr.serviceEndDate ?? ""} onChange={v=>u("criticalRole",{...cr,serviceEndDate:v || null})}/></Field>
                <Field label="Cursos o funciones específicas"><Textarea value={cr.specificCoursesOrDutiesTaught} onChange={v=>u("criticalRole",{...cr,specificCoursesOrDutiesTaught:v})} placeholder="Qué enseñaste, programas específicos..."/></Field>
                <Field label="Evidencia de institucionalización"><Textarea value={cr.institutionalizationEvidence} onChange={v=>u("criticalRole",{...cr,institutionalizationEvidence:v})} placeholder="Adopción curricular, invitación renovada..."/></Field>
              </div>
            )}
          </div>
          );
        })()}
      </div>

      {/* J — Web presence */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="font-semibold text-gray-800">Presencia web profesional</p>
        <Field label="¿Tienes página web o perfil profesional en línea?">
          <YesNo value={d.hasWebsite} onChange={v => u("hasWebsite", v)} yesLabel="Sí tengo" noLabel="No tengo"/>
        </Field>
        {d.hasWebsite === true && (
          <Field label="URL de tu sitio web o perfil">
            <TextInput value={d.websiteUrl} onChange={v => u("websiteUrl", v)} placeholder="https://www.tunombre.com"/>
          </Field>
        )}
        {d.hasWebsite === false && (
          <Field label="¿Sobre qué te gustaría que fuera tu página web profesional?">
            <Textarea value={d.websiteTopicIdea} onChange={v => u("websiteTopicIdea", v)}
              placeholder="Ej: Una plataforma que muestre mi trabajo en cirugía robótica y mis publicaciones académicas..."/>
          </Field>
        )}
      </div>

      {/* I — Income evidence */}
      <SectionDivider title="I — Evidencia de ingresos"/>
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Evidencia de ingresos</p>

        <div className="space-y-3">
          <Field label="¿Tiene declaraciones de renta de los últimos 2 años?">
            <YesNo value={d.incomeEvidence.hasTaxReturns} onChange={v => uIncome({ hasTaxReturns: v })} yesLabel="Sí" noLabel="No"/>
          </Field>
          {d.incomeEvidence.hasTaxReturns === true && (
            <FileUpload
              sessionId={sessionId}
              storagePath="module10/income/tax-returns"
              filePath={d.incomeEvidence.taxFilePath}
              fileName={d.incomeEvidence.taxFileName}
              onChange={({ filePath, fileName }) => uIncome({ taxFilePath: filePath, taxFileName: fileName })}
            />
          )}
        </div>

        <div className="space-y-3">
          <Field label="¿Tiene certificaciones de contador o empleador?">
            <YesNo value={d.incomeEvidence.hasCertifications} onChange={v => uIncome({ hasCertifications: v })} yesLabel="Sí" noLabel="No"/>
          </Field>
          {d.incomeEvidence.hasCertifications === true && (
            <FileUpload
              sessionId={sessionId}
              storagePath="module10/income/certifications"
              filePath={d.incomeEvidence.certFilePath}
              fileName={d.incomeEvidence.certFileName}
              onChange={({ filePath, fileName }) => uIncome({ certFilePath: filePath, certFileName: fileName })}
            />
          )}
        </div>

        <div className="space-y-3">
          <Field label="¿Tiene contratos vigentes?">
            <YesNo value={d.incomeEvidence.hasContracts} onChange={v => uIncome({ hasContracts: v })} yesLabel="Sí" noLabel="No"/>
          </Field>
          {d.incomeEvidence.hasContracts === true && (
            <FileUpload
              sessionId={sessionId}
              storagePath="module10/income/contracts"
              filePath={d.incomeEvidence.contractFilePath}
              fileName={d.incomeEvidence.contractFileName}
              onChange={({ filePath, fileName }) => uIncome({ contractFilePath: filePath, contractFileName: fileName })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
