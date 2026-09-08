/**
 * MASTER-SUBJECT-002 — FIRST VERTICAL-SLICE IMPLEMENTATION EXECUTION
 *
 * Test interaction: retrieval and consumption of the already-governed
 * INA §101(a)(1) definition of "administrator".
 *
 * Implements only what is already architecturally established for
 * TC-01 (Knowledge Requirement representation: KR-01/KR-02/KR-03).
 * Does not invent, default, or assume a value for which no established
 * source/rule exists. RC-01 (KR-03 value-constitution rule) remains
 * OPEN as of this execution — see docs/MASTER-SUBJECT-002-CONSOLIDATED-STATE.md.
 */

const crypto = require('crypto');

class VerticalSliceBlocker extends Error {
  constructor(details) {
    super(`Vertical-slice execution blocked at: ${details.step}`);
    this.details = details;
  }
}

function buildKnowledgeRequirement({ need }) {
  // KR-01 — Requirement Identity: mechanical, non-semantic identifier
  // generation (established as not requiring architectural invention).
  const kr01 = crypto.randomUUID();

  // KR-02 — Knowledge Subject / Need: directly supplied by the caller
  // at invocation time (established source).
  const kr02 = need;

  // KR-03 — Specialization Context: value-constitution rule and source
  // are NOT ESTABLISHED (RC-01). No value may be invented or defaulted.
  const kr03Source = null;

  if (kr03Source === null) {
    throw new VerticalSliceBlocker({
      step: 'TC-01 — Knowledge Requirement construction (KR-03)',
      architecture: 'TC-01 (Knowledge Requirement representation) / RC-01 (KR-03 value-constitution rule)',
      concreteInput: { kr01, kr02 },
      operationAttempted: 'Populate KR-03 (Specialization Context) for this Knowledge Requirement',
      missingElement: 'KR-03 value-constitution rule and source (RC-01)',
      observedBlock:
        'No established rule or source exists for what constitutes a valid KR-03 value for this ' +
        'test interaction. INA §101(a)(1) is a general-definitions provision, not tied to any ' +
        'established visa classification, so no candidate value is even plausible without invention.',
      reasonIlNotAuthorized:
        'Supplying any KR-03 value (default, inferred, or otherwise) would require inventing an ' +
        'architectural rule this execution has no authority to create (Test-Data Discipline, Section 4).',
    });
  }

  return { kr01, kr02, kr03: kr03Source };
}

const EXECUTION_ID = `vs-exec-${new Date().toISOString()}`;
console.log(`EXECUTION ID: ${EXECUTION_ID}`);
console.log('TEST INTERACTION: Retrieval and consumption of the governed INA §101(a)(1) definition of "administrator".');
console.log('');

try {
  const kr = buildKnowledgeRequirement({
    need: 'Obtain the governed INA definition corresponding to "administrator" under INA §101(a)(1).',
  });
  console.log('RESULT: COMPLETED PATH (unexpected)');
  console.log(kr);
} catch (err) {
  if (err instanceof VerticalSliceBlocker) {
    console.log('RESULT: EVIDENCED BLOCKER');
    console.log(JSON.stringify(err.details, null, 2));
    process.exitCode = 0;
  } else {
    throw err;
  }
}
