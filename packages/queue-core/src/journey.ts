/**
 * Stage-to-stage journeys (FR-8, FR-23). Stages are service IDs.
 * Example hospital journey: records -> triage -> consultation -> pharmacy, with lab as a side
 * stage that returns to consultation.
 */
export interface Journey {
  steps: readonly string[];
  sideStages: Readonly<Record<string, { returnTo: string }>>;
}

/** What staff chose when they clicked Done. */
export type DoneChoice = { kind: 'next' } | { kind: 'stage'; serviceId: string } | { kind: 'end' };

export type DoneOutcome =
  | { action: 'end' }
  | { action: 'enqueue'; serviceId: string; sortTime: number; priorityLevel: number };

/** The default next stage after `serviceId`, or null when the visit ends there. */
export function nextStage(journey: Journey, serviceId: string): string | null {
  const side = journey.sideStages[serviceId];
  if (side) return side.returnTo;
  const i = journey.steps.indexOf(serviceId);
  if (i === -1) return null;
  return journey.steps[i + 1] ?? null;
}

/**
 * What happens to a patient when staff click Done.
 * The patient joins the back of the next stage's queue, ordered by when they finished this stage,
 * keeps their ticket number, and keeps their priority level.
 */
export function onDone(input: {
  journey: Journey;
  serviceId: string;
  priorityLevel: number;
  finishedAt: number;
  choice: DoneChoice;
}): DoneOutcome {
  const { journey, serviceId, priorityLevel, finishedAt, choice } = input;
  if (choice.kind === 'end') return { action: 'end' };

  const target = choice.kind === 'stage' ? choice.serviceId : nextStage(journey, serviceId);
  if (target === null) return { action: 'end' };
  if (target === serviceId) {
    throw new Error(`cannot move a ticket to the stage it is already in (${serviceId})`);
  }
  return { action: 'enqueue', serviceId: target, sortTime: finishedAt, priorityLevel };
}
