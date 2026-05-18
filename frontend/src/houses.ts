/**
 * THE SPHERE — House Topology (STABLE).
 *
 * 1:1 mirror of /app/backend/houses.py. Imported by `design.ts` and the UI
 * to label the 8 houses of the lifecycle. Spatial vectors and antipodal
 * pairings are PRESERVED from the original physics model.
 *
 * Rule: only this module defines what the houses are. Probes & aspects
 * (aspects.ts) MUST NOT redefine them.
 */

export type HouseMeta = {
  index: number;             // 1..8
  arrayIndex: number;        // 0..7 (matches physics arrays)
  code: string;              // NNO, ONO, …
  title: string;             // ORIGIN, OFFERING, …
  coreEnergy: string;
  guidingQuestion: string;
  lowState: string;
  highState: string;
  vector: [number, number, number];
  oppositeIndex: number;     // 1-based antipode
};

export const HOUSES: HouseMeta[] = [
  {
    index: 1, arrayIndex: 0,
    code: 'NNO', title: 'ORIGIN',
    coreEnergy:      'birth of intention, identity, initial direction',
    guidingQuestion: 'What wants to emerge?',
    lowState:        'diffuse impulse, unclear identity',
    highState:       'clear intention, coherent beginning',
    vector: [5, 0, 0], oppositeIndex: 5,
  },
  {
    index: 2, arrayIndex: 1,
    code: 'ONO', title: 'OFFERING',
    coreEnergy:      'what the system creates and cares about',
    guidingQuestion: 'What is being formed as substance?',
    lowState:        'imitation, weak substance',
    highState:       'authentic offering, inner commitment',
    vector: [0, 5, 0], oppositeIndex: 6,
  },
  {
    index: 3, arrayIndex: 2,
    code: 'OSO', title: 'EXPRESSION',
    coreEnergy:      'communication, visibility, outward signal',
    guidingQuestion: 'How does the system speak outward?',
    lowState:        'noise, unclear message',
    highState:       'precise signal, resonant expression',
    vector: [0, 0, 5], oppositeIndex: 7,
  },
  {
    index: 4, arrayIndex: 3,
    code: 'SSO', title: 'GROUND',
    coreEnergy:      'foundation, research, truth-testing',
    guidingQuestion: 'What principle carries the system?',
    lowState:        'unstable assumptions',
    highState:       'deep insight, verified foundation',
    vector: [3.5, 3.5, 0], oppositeIndex: 8,
  },
  {
    index: 5, arrayIndex: 4,
    code: 'SSW', title: 'EMBODIMENT',
    coreEnergy:      'capacity, resources, materialization',
    guidingQuestion: 'What can be embodied?',
    lowState:        'overload, weak capacity',
    highState:       'grounded resources, available energy',
    vector: [-5, 0, 0], oppositeIndex: 1,
  },
  {
    index: 6, arrayIndex: 5,
    code: 'WSW', title: 'VALUE',
    coreEnergy:      'exchange, usefulness, value flow',
    guidingQuestion: 'Does the world receive it?',
    lowState:        'no traction, blocked flow',
    highState:       'real value, healthy exchange',
    vector: [0, -5, 0], oppositeIndex: 2,
  },
  {
    index: 7, arrayIndex: 6,
    code: 'WNW', title: 'FEEDBACK',
    coreEnergy:      'observation, measurement, learning',
    guidingQuestion: 'What does the system learn?',
    lowState:        'blindness, ignored signals',
    highState:       'clear feedback, adaptive intelligence',
    vector: [0, 0, -5], oppositeIndex: 3,
  },
  {
    index: 8, arrayIndex: 7,
    code: 'NNW', title: 'EVALUATION',
    coreEnergy:      'closure, consequence, transition',
    guidingQuestion: 'What must be released or integrated?',
    lowState:        'unresolved residue',
    highState:       'clean transition, readiness for next cycle',
    vector: [-3.5, -3.5, 0], oppositeIndex: 4,
  },
];
