// ─── Module 1 — Identity ─────────────────────────────────────────────────────
export type Module1 = {
  fullName: string;
  dateOfBirth: string;
  countryOfBirth: string;
  nationalities: string;
  countryOfResidence: string;
  cityOfResidence: string;
  email: string;
  whatsapp: string;
  profession: string;
  industry: string;
  yearsExperience: string;
  usaObjective: string; // "trabajo"|"residencia_permanente"|"ambos"|""
  visaType: string;     // "O-1A"|"O-1B"|"EB-1A"|"EB-1B"|"no_se"|""
};

// ─── Module 2 — Documents + Family ───────────────────────────────────────────
export type DocField = {
  has: boolean | null;
  notes: string;
  documentNumber: string;
  expiryDate: string;
  issuedDate: string;
  issuedCountry: string;
  issuedCity: string;
  visaSubtype: string;
  filePath: string;
  fileName: string;
};

export type SpouseInfo = {
  name: string; nationality: string; countryOfResidence: string; profession: string;
};

export type ChildDocSet = {
  id: string;
  // biographical
  childName: string;
  dateOfBirth: string;
  nationality: string;
  countryOfResidence: string;
  // documents
  birthCert: DocField;
  passport: DocField;
  visa: DocField;
};

export type Module2 = {
  // personal immigration documents
  passport: DocField;
  usVisa: DocField;
  i94: DocField;
  i797: DocField;
  ead: DocField;
  i20: DocField;
  ds2019: DocField;
  // marital status (replaces isMarried boolean)
  maritalStatus: string; // "soltero"|"casado"|"union_libre"|"divorciado"|"viudo"|""
  // spouse biographical + documents
  spouse: SpouseInfo;
  spouseMarriageCert: DocField;
  spousePassport: DocField;
  spouseVisa: DocField;
  spouseI94: DocField;
  // children — biographical + documents merged
  hasChildren: boolean | null;
  childrenDocs: ChildDocSet[];
};

// ─── Module 4 — Immigration History ──────────────────────────────────────────
export type UsaVisit = {
  id: string; entryDate: string; exitDate: string; visaType: string; purpose: string;
};
export type VisaRejection = {
  id: string; country: string; visaType: string; year: string; reason: string;
};
export type Module4 = {
  hasBeenInUSA: boolean | null;
  usaVisits: UsaVisit[];
  hasVisaRejection: boolean | null;
  visaRejections: VisaRejection[];
  hasDeportation: boolean | null;
  deportationDescription: string;
};

// ─── Module 5 — Formal Education ─────────────────────────────────────────────
export type DegreeEntry = {
  id: string; institution: string; country: string;
  degreeType: string; degreeName: string;
  startYear: string; graduationYear: string;
  hasDiploma: string; // "si"|"no"|"en_tramite"
  filePath: string;
  fileName: string;
};
export type Module5 = { degrees: DegreeEntry[] };

// ─── Module 6 — Certifications ───────────────────────────────────────────────
export type CertEntry = {
  id: string; name: string; institution: string; country: string;
  year: string; isActive: string; hasCertificate: boolean | null;
  filePath: string;
  fileName: string;
};
export type Module6 = { certifications: CertEntry[] };

// ─── Module 7 — Work Experience ──────────────────────────────────────────────
export type EmploymentEntry = {
  id: string; company: string; country: string; city: string;
  title: string; startDate: string; endDate: string; isCurrent: boolean;
  mainFunctions: string; importantProjects: string; mainAchievements: string;
  peopleSupervised: string; managesBudget: boolean | null; budgetAmount: string;
  whyImportant: string;
  supervisorName: string; supervisorTitle: string; supervisorEmail: string; supervisorPhone: string;
  companyWebsite: string; internationalRecognition: string; // "si"|"no"|"no_se"
};
export type Module7 = { employment: EmploymentEntry[] };

// ─── Module 8 — Own Businesses ───────────────────────────────────────────────
export type BusinessEntry = {
  id: string; name: string; country: string; foundedYear: string;
  industry: string; role: string; isActive: boolean | null;
  employeeCount: string; description: string; website: string;
};
export type Module8 = { hasOwnBusinesses: boolean | null; businesses: BusinessEntry[] };

// ─── Module 9 — References ───────────────────────────────────────────────────
export type ReferenceEntry = {
  id: string; name: string; currentTitle: string; company: string; country: string;
  email: string; phone: string;
  relationshipType: string; // "supervisor"|"colega"|"cliente"|"mentor"|"colaborador"|"subordinado"|"otro"|""
  relationshipDuration: string;
  signerCredentials: string;
  specificAchievements: string;
};
export type Module9 = { references: ReferenceEntry[] };

// ─── Module 10 — Evidence ────────────────────────────────────────────────────
export type EvidenceStatus = "tengo" | "no_tengo" | "tal_vez" | "";

export type AwardEvidence      = { id: string; name: string; org: string; year: string; country: string; description: string; link: string; filePath: string; fileName: string };
export type MembershipEvidence = { id: string; orgName: string; country: string; yearJoined: string; requiredEval: boolean | null; filePath: string; fileName: string };
export type MediaEvidence      = { id: string; medium: string; title: string; date: string; author: string; link: string; reach: string; filePath: string; fileName: string };
export type ArticleEvidence    = { id: string; title: string; publication: string; date: string; link: string; filePath: string; fileName: string };
export type BookEvidence       = { id: string; title: string; publisher: string; year: string; isbn: string; link: string; filePath: string; fileName: string };
export type ConferenceEvidence = { id: string; event: string; org: string; country: string; date: string; topic: string; role: string; filePath: string; fileName: string };
export type JudgingEvidence    = { id: string; eventOrProcess: string; org: string; country: string; date: string; roleDescription: string; filePath: string; fileName: string };
export type PatentEvidence     = { id: string; type: string; name: string; country: string; year: string; number: string; filePath: string; fileName: string };
export type IncomeEvidence     = {
  hasTaxReturns: boolean | null; taxFilePath: string; taxFileName: string;
  hasCertifications: boolean | null; certFilePath: string; certFileName: string;
  hasContracts: boolean | null; contractFilePath: string; contractFileName: string;
};

export type Module10 = {
  awardsStatus: EvidenceStatus;      awards: AwardEvidence[];      awardsDisposition: string;
  membershipsStatus: EvidenceStatus; memberships: MembershipEvidence[]; membershipsDisposition: string;
  mediaStatus: EvidenceStatus;       media: MediaEvidence[];       mediaDisposition: string;
  articlesStatus: EvidenceStatus;    articles: ArticleEvidence[];  articlesDisposition: string;
  booksStatus: EvidenceStatus;       books: BookEvidence[];        booksDisposition: string;
  conferencesStatus: EvidenceStatus; conferences: ConferenceEvidence[]; conferencesDisposition: string;
  judgingStatus: EvidenceStatus;     judging: JudgingEvidence[];   judgingDisposition: string;
  patentsStatus: EvidenceStatus;     patents: PatentEvidence[];    patentsDisposition: string;
  incomeEvidence: IncomeEvidence;
  hasWebsite: boolean | null;
  websiteUrl: string;
  websiteTopicIdea: string;
};

// ─── Module 11 — Strategic Information ───────────────────────────────────────
export type StrategicAnswer = { answer: string; hasEvidence: boolean | null; filePath: string; fileName: string };
export type Module11 = {
  createdMethod: StrategicAnswer;
  ledImpactProjects: StrategicAnswer;
  solvedComplexProblems: StrategicAnswer;
  trainedProfessionals: StrategicAnswer;
  consultedForExpertise: StrategicAnswer;
  evaluatedOthers: StrategicAnswer;
  workedForRecognized: StrategicAnswer;
  aboveAverageIncome: StrategicAnswer;
  willingToConfirm: StrategicAnswer;
  additionalInfo: StrategicAnswer;
};

// ─── Module 12 — Optional Strategic Services ─────────────────────────────────
export type Module12 = { interest: string }; // "si"|"tal_vez"|"no"|""

// ─── Module 14 — Petitioner Information ──────────────────────────────────────
export type ItineraryItem = {
  id: string;
  eventDate: string;
  eventEndDate: string;
  eventName: string;
  venue: string;
  city: string;
  state: string;
  employerName: string;
};

export type Module14 = {
  petitionerType: "empresa" | "persona_natural" | "agente" | "";
  // empresa
  companyName: string;
  ein: string;
  stateOfIncorporation: string;
  companyAddress: string;
  representativeName: string;
  representativeTitle: string;
  companyArticlesPath: string;
  companyArticlesName: string;
  einDocPath: string;
  einDocName: string;
  // persona_natural
  petitionerFullName: string;
  petitionerDateOfBirth: string;
  petitionerAddress: string;
  petitionerRelationship: string;
  petitionerIdPath: string;
  petitionerIdName: string;
  petitionerBirthCertPath: string;
  petitionerBirthCertName: string;
  // agente
  agentName: string;
  agentEmployerName: string;
  agentAgreementType: string;
  // common
  businessNature: string;
  offeredPosition: string;
  serviceStartDate: string;
  serviceEndDate: string;
  hasWrittenContract: boolean | null;
  contractPath: string;
  contractName: string;
  contractVerbalTerms: string;
  // itinerary
  hasItinerary: boolean | null;
  itineraryItems: ItineraryItem[];
};

// ─── Module 15 — Consultative Opinion & O-2 Companions ───────────────────────
export type O2Companion = {
  id: string;
  fullName: string;
  nationality: string;
  role: string;
  whyEssential: string;
  relationshipDuration: string;
  passportPath: string;
  passportName: string;
  employmentEvidencePath: string;
  employmentEvidenceName: string;
};

export type Module15 = {
  // Section A — Consultative opinion
  hasPeerGroup: "si" | "no" | "no_se" | "";
  peerGroupName: string;
  peerGroupLetterType: "opinion_favorable" | "no_objecion" | "";
  peerGroupLetterPath: string;
  peerGroupLetterName: string;
  alternativeContactName: string;
  alternativeContactOrg: string;
  alternativeContactRelation: string;
  noAssociationJustification: string;
  consultativeNotes: string;
  // Section B — O-2 companions
  hasO2Companions: boolean | null;
  companions: O2Companion[];
};

// ─── Full form ────────────────────────────────────────────────────────────────
export type IntakeForm = {
  module1:  Module1;
  module2:  Module2;
  module4:  Module4;
  module5:  Module5;
  module6:  Module6;
  module7:  Module7;
  module8:  Module8;
  module9:  Module9;
  module10: Module10;
  module11: Module11;
  module12: Module12;
  module14: Module14;
  module15: Module15;
};

export type ModuleStatus = "complete" | "partial" | "empty";
