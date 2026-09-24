export const MAX_LABEL_IMAGES = 3;

export function mergeImageUris(
  current: readonly string[],
  incoming: readonly string[],
): string[] {
  return [...new Set([...current, ...incoming])].slice(0, MAX_LABEL_IMAGES);
}
