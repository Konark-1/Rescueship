/**
 * BullMQ custom job IDs must not contain ':' (BullMQ reserves it for its own
 * key layout and throws "Custom Id cannot contain :" for anything other than
 * its internal 3-segment format). Build deterministic, dedupe-safe IDs here so
 * no producer ever hand-rolls a format that fails at enqueue time.
 */
export function makeJobId(...parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).length > 0)
    .map((p) => String(p).replace(/[^A-Za-z0-9_\-.]/g, '_'))
    .join('__');
}
