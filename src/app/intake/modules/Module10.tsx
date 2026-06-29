import type {
  Module10, EvidenceStatus, IncomeEvidence,
  AwardEvidence, MembershipEvidence, MediaEvidence, ArticleEvidence,
  BookEvidence, ConferenceEvidence, JudgingEvidence, PatentEvidence,
} from "../types";
import {
  Field, TextInput, Textarea, Select, YesNo,
  AddBtn, Card, EvidenceSelector, DispositionBox, SectionDivider, InfoBox, FileUpload,
} from "../primitives";

type Props = { data: Module10; onChange: (d: Module10) => void; sessionId: string };

const genId = () => Math.random().toString(36).slice(2,9);

function EvidenceSection<T extends { id: string }>({
  title, status, onStatus, items, onItems, disposition, onDisposition, emptyItem,
  sessionId, sectionKey, children,
}: {
  title: string;
  status: EvidenceStatus; onStatus: (s: EvidenceStatus) => void;
  items: T[]; onItems: (items: T[]) => void;
  disposition: string; onDisposition: (s: string) => void;
  emptyItem: () => T;
  sessionId: string;
  sectionKey: string;
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
        <div className="mt-2"><EvidenceSelector value={status} onChange={onStatus}/></div>
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
        <DispositionBox value={disposition} onChange={onDisposition} label={title.toLowerCase()}/>
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
        emptyItem={() => ({ id:genId(), name:"", org:"", year:"", country:"", description:"", link:"", filePath:"", fileName:"" } as AwardEvidence)}
        sessionId={sessionId} sectionKey="awards"
      >
        {(item, _, upd) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre del premio"><TextInput value={item.name} onChange={v=>upd("name",v)} placeholder="Oscar, Grammy..."/></Field>
            <Field label="Organización"><TextInput value={item.org} onChange={v=>upd("org",v)} placeholder="Academy of Motion Picture Arts..."/></Field>
            <Field label="Año"><TextInput type="number" value={item.year} onChange={v=>upd("year",v)} placeholder="2022"/></Field>
            <Field label="País"><TextInput value={item.country} onChange={v=>upd("country",v)} placeholder="USA"/></Field>
            <Field label="Descripción breve"><TextInput value={item.description} onChange={v=>upd("description",v)} placeholder="Premio al mejor..."/></Field>
            <Field label="Link" hint="Opcional"><TextInput value={item.link} onChange={v=>upd("link",v)} placeholder="https://..."/></Field>
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
        emptyItem={() => ({ id:genId(), eventOrProcess:"", org:"", country:"", date:"", roleDescription:"", filePath:"", fileName:"" } as JudgingEvidence)}
        sessionId={sessionId} sectionKey="judging"
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
