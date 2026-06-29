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

// ─── Module 2 — Personal Documents ───────────────────────────────────────────
export type DocField = { has: boolean | null; notes: string };

export type ChildDocSet = {
  id: string;
  childName: string;
  birthCert: DocField;
  passport: DocField;
  visa: DocField;
};

export type Module2 = {
  passport: DocField;
  usVisa: DocField;
  i94: DocField;
  i797: DocField;
  ead: DocField;
  i20: DocField;
  ds2019: DocField;
  isMarried: boolean | null;
  spouseMarriageCert: DocField;
  spousePassport: DocField;
  spouseVisa: DocField;
  spouseI94: DocField;
  hasChildren: boolean | null;
  childrenDocs: ChildDocSet[];
};

// ─── Module 3 — Family Group ──────────────────────────────────────────────────
export type SpouseInfo = {
  name: string; nationality: string; countryOfResidence: string; profession: string;
};
export type ChildInfo = {
  id: string; name: string; dateOfBirth: string; nationality: string; countryOfResidence: string;
};
export type Module3 = {
  maritalStatus: string; // "soltero"|"casado"|"union_libre"|"divorciado"|"viudo"|""
  spouse: SpouseInfo;
  hasChildren: boolean | null;
  children: ChildInfo[];
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
  hasCurrentUSVisa: boolean | null;
  currentVisaType: string;
  currentVisaExpiry: string;
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
};
export type Module5 = { degrees: DegreeEntry[] };

// ─── Module 6 — Certifications ───────────────────────────────────────────────
export type CertEntry = {
  id: string; name: string; institution: string; country: string;
  year: string; isActive: string; hasCertificate: boolean | null;
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
  email: string; phone: string; howYouKnow: string; whatTheyCouldSay: string;
  hasBeenAsked: boolean | null;
};
export type Module9 = { references: ReferenceEntry[] };

// ─── Module 10 — Evidence ────────────────────────────────────────────────────
export type EvidenceStatus = "tengo" | "no_tengo" | "tal_vez" | "";

export type AwardEvidence    = { id: string; name: string; org: string; year: string; country: string; description: string; link: string };
export type MembershipEvidence = { id: string; orgName: string; country: string; yearJoined: string; requiredEval: boolean | null };
export type MediaEvidence    = { id: string; medium: string; title: string; date: string; author: string; link: string; reach: string };
export type ArticleEvidence  = { id: string; title: string; publication: string; date: string; link: string };
export type BookEvidence     = { id: string; title: string; publisher: string; year: string; isbn: string; link: string };
export type ConferenceEvidence = { id: string; event: string; org: string; country: string; date: string; topic: string; role: string };
export type JudgingEvidence  = { id: string; eventOrProcess: string; org: string; country: string; date: string; roleDescription: string };
export type PatentEvidence   = { id: string; type: string; name: string; country: string; year: string; number: string };
export type IncomeEvidence   = { hasTaxReturns: boolean | null; hasCertifications: boolean | null; hasContracts: boolean | null };

export type Module10 = {
  awardsStatus: EvidenceStatus;     awards: AwardEvidence[];      awardsDisposition: string;
  membershipsStatus: EvidenceStatus; memberships: MembershipEvidence[]; membershipsDisposition: string;
  mediaStatus: EvidenceStatus;      media: MediaEvidence[];        mediaDisposition: string;
  articlesStatus: EvidenceStatus;   articles: ArticleEvidence[];   articlesDisposition: string;
  booksStatus: EvidenceStatus;      books: BookEvidence[];         booksDisposition: string;
  conferencesStatus: EvidenceStatus; conferences: ConferenceEvidence[]; conferencesDisposition: string;
  judgingStatus: EvidenceStatus;    judging: JudgingEvidence[];    judgingDisposition: string;
  patentsStatus: EvidenceStatus;    patents: PatentEvidence[];     patentsDisposition: string;
  incomeEvidence: IncomeEvidence;
};

// ─── Module 11 — Strategic Information ───────────────────────────────────────
export type StrategicAnswer = { answer: string; hasEvidence: boolean | null };
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

// ─── Full form ────────────────────────────────────────────────────────────────
export type IntakeForm = {
  module1: Module1;
  module2: Module2;
  module3: Module3;
  module4: Module4;
  module5: Module5;
  module6: Module6;
  module7: Module7;
  module8: Module8;
  module9: Module9;
  module10: Module10;
  module11: Module11;
  module12: Module12;
};

export type ModuleStatus = "complete" | "partial" | "empty";
