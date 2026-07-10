// USCIS Filing Address Routing Matrix
//
// Dato de referencia versionado. NO conectado a ninguna UI todavía — se usará
// cuando se construya A4 (Petition Builder).
//
// Criterios de enrutamiento:
//   - I-129 (O-1A / O-1B / O-2): estado de la oficina principal del PETICIONARIO.
//   - I-140 (EB-1A): estado donde el BENEFICIARIO trabajará.

export type FilingAddress = {
  attn: string;
  uspsPOBox: string;
  uspsCity: string;
  courierAddress: string;
  courierCity: string;
};

export type StateGroup = string[]; // lista de estados/territorios

// ─── I-129 — categorías O-1A, O-1B, O-2 ──────────────────────────────────────
// Criterio de enrutamiento: estado de la oficina principal del PETICIONARIO.
// Las listas de estados son idénticas con y sin Premium; solo cambia la dirección.

const I129_CHICAGO_STATES: StateGroup = [
  "AK", "CT", "DE", "DC", "ID", "IL", "IN", "ME", "MD", "MA", "MI", "MN",
  "MO", "MT", "NH", "NJ", "NY", "ND", "OH", "OR", "PA", "RI", "SD", "VT",
  "VA", "WA", "WI", "WY",
];

const I129_DALLAS_STATES: StateGroup = [
  "AL", "AS", "AZ", "AR",
  "Armed Forces-America", "Armed Forces-Europe", "Armed Forces-Pacific",
  "CA", "CO", "FL", "GA", "GU", "HI", "IA", "KS", "KY", "LA", "FM", "MS",
  "NE", "NV", "NM", "NC", "MP", "OK", "PW", "PR", "SC", "TN", "TX", "VI",
  "UT", "WV",
];

export const I129_ROUTING = {
  withPremium: {
    chicago: {
      states: I129_CHICAGO_STATES,
      address: {
        attn: "Premium I-129 O",
        uspsPOBox: "P.O. Box 88292",
        uspsCity: "Chicago, IL 60680-1292",
        courierAddress: "131 S. Dearborn St., Third Floor",
        courierCity: "Chicago, IL 60603-5517",
      } satisfies FilingAddress,
    },
    dallas: {
      states: I129_DALLAS_STATES,
      address: {
        attn: "Premium I-129 O",
        uspsPOBox: "P.O. Box 660090",
        uspsCity: "Dallas, TX 75265-0090",
        courierAddress: "2501 S. State Highway 121 Business, Suite 400",
        courierCity: "Lewisville, TX 75067-8003",
      } satisfies FilingAddress,
    },
  },
  withoutPremium: {
    chicago: {
      states: I129_CHICAGO_STATES,
      address: {
        attn: "I-129 O",
        uspsPOBox: "P.O. Box 88290",
        uspsCity: "Chicago, IL 60680-1290",
        courierAddress: "131 S. Dearborn St., Third Floor",
        courierCity: "Chicago, IL 60603-5517",
      } satisfies FilingAddress,
    },
    dallas: {
      states: I129_DALLAS_STATES,
      address: {
        attn: "I-129 O",
        uspsPOBox: "P.O. Box 653077",
        uspsCity: "Dallas, TX 75265-3077",
        courierAddress: "2501 S. State Highway 121 Business, Suite 400",
        courierCity: "Lewisville, TX 75067-8003",
      } satisfies FilingAddress,
    },
  },
};

// ─── I-140 — EB-1A ───────────────────────────────────────────────────────────
// Criterio de enrutamiento: estado donde el BENEFICIARIO trabajará.

export const I140_ROUTING = {
  // Escenario 1: I-140 solo, sin Premium, sin I-485.
  soloNoPremium: {
    dallas: {
      states: [
        "AL", "AK", "AZ", "AR", "CA", "CO", "FL", "Fuerzas Armadas", "GA",
        "GU", "HI", "ID", "KY", "LA", "Marshall Islands", "MD", "MS", "MT",
        "NV", "NM", "NC", "Northern Mariana", "OK", "OR", "PR", "SC", "TN",
        "TX", "USVI", "UT", "VA", "WA", "WV", "WY",
      ] as StateGroup,
      address: {
        attn: "I-140",
        uspsPOBox: "P.O. Box 660128",
        uspsCity: "Dallas, TX 75266-0128",
        courierAddress: "2501 S. State Hwy. 121 Business, Suite 400",
        courierCity: "Lewisville, TX 75067-8003",
      } satisfies FilingAddress,
    },
    chicago: {
      states: [
        "CT", "DE", "DC", "IL", "IN", "IA", "KS", "ME", "MA", "MI", "MN",
        "MO", "NE", "NH", "NJ", "NY", "ND", "OH", "PA", "RI", "SD", "VT", "WI",
      ] as StateGroup,
      address: {
        attn: "I-140",
        uspsPOBox: "P.O. Box 88774",
        uspsCity: "Chicago, IL 60680-1774",
        courierAddress: "131 S. Dearborn St., 3rd Floor",
        courierCity: "Chicago, IL 60603-5517",
      } satisfies FilingAddress,
    },
  },
  // Escenario 2: I-140 + I-485 concurrente, sin Premium — destino único nacional.
  concurrentNoPremium: {
    nationwide: {
      address: {
        attn: "NFB",
        uspsPOBox: "P.O. Box 660867",
        uspsCity: "Dallas, TX 75266-0867",
        courierAddress: "2501 S. State Highway 121 Business, Suite 400",
        courierCity: "Lewisville, TX 75067-8003",
      } satisfies FilingAddress,
    },
  },
  // Escenario 3: I-140 + Premium (con o sin I-485 concurrente — mismo destino).
  withPremium: {
    phoenix: {
      states: [
        "AK", "AZ", "AR", "Fuerzas Armadas", "CA", "CO", "GA", "GU", "HI",
        "ID", "LA", "Marshall Islands", "MT", "NV", "NM", "Northern Mariana",
        "OK", "OR", "TX", "USVI", "UT", "WA", "WY",
      ] as StateGroup,
      address: {
        attn: "Premium I-140",
        uspsPOBox: "P.O. Box 21500",
        uspsCity: "Phoenix, AZ 85036-1500",
        courierAddress: "2108 E. Elliot Rd.",
        courierCity: "Tempe, AZ 85284-1806",
      } satisfies FilingAddress,
    },
    elgin: {
      states: [
        "AL", "CT", "DE", "DC", "FL", "IL", "IN", "IA", "KS", "KY", "ME",
        "MD", "MA", "MI", "MN", "MS", "MO", "NE", "NH", "NJ", "NY", "NC",
        "ND", "OH", "PA", "PR", "RI", "SC", "SD", "TN", "VT", "VA", "WV", "WI",
      ] as StateGroup,
      address: {
        attn: "Premium I-140",
        uspsPOBox: "P.O. Box 4008",
        uspsCity: "Carol Stream, IL 60197-4008",
        courierAddress: "2500 Westfield Drive",
        courierCity: "Elgin, IL 60124-7836",
      } satisfies FilingAddress,
    },
  },
};
