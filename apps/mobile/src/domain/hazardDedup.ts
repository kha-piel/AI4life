import type { SceneHazard } from "./types";

export type HazardMemory = Record<string, { seenAt: number; urgency: SceneHazard["urgency"] }>;

const urgencyRank: Record<SceneHazard["urgency"], number> = {
  info: 0,
  warning: 1,
  urgent: 2,
};

export function filterNovelHazards(
  hazards: SceneHazard[],
  memory: HazardMemory,
  now: number,
  cooldownMs = 8_000,
): { novel: SceneHazard[]; nextMemory: HazardMemory } {
  const nextMemory = { ...memory };
  const novel = hazards.filter((hazard) => {
    const key = `${hazard.type}:${hazard.direction}`;
    const previous = memory[key];
    const shouldAnnounce =
      previous === undefined ||
      now - previous.seenAt >= cooldownMs ||
      urgencyRank[hazard.urgency] > urgencyRank[previous.urgency];

    nextMemory[key] = { seenAt: now, urgency: hazard.urgency };
    return shouldAnnounce;
  });
  return { novel, nextMemory };
}

