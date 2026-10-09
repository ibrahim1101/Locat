/** Read the encryption epoch from a relay envelope without accepting unsafe values.
 * Missing epoch is supported for legacy group messages (epoch 1).
 * Never silently downgrade an explicitly malformed epoch to a current key.
 */
export function readGroupEpoch(envelopeJson: string): number {
  const envelope: unknown = JSON.parse(envelopeJson);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope))
    throw new Error("Invalid encrypted group envelope");
  const epoch = (envelope as Record<string, unknown>).groupEpoch;
  if (epoch === undefined) return 1;
  if (typeof epoch !== "number" || !Number.isSafeInteger(epoch) || epoch < 1)
    throw new Error("Invalid group key epoch");
  return epoch;
}
