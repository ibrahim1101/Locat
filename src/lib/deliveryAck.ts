/** Acknowledge archived relay deliveries in server-sized batches.
 * A failed batch remains queued remotely for the next idempotent sync pass.
 * Continue attempting other batches so a transient failure cannot block them.
 */
export async function acknowledgeArchivedDeliveries(
  messageIds: number[],
  acknowledge: (ids: number[]) => Promise<unknown>,
): Promise<boolean> {
  const uniqueIds = [...new Set(messageIds)];
  let failed = false;
  for (let index = 0; index < uniqueIds.length; index += 500) {
    try {
      await acknowledge(uniqueIds.slice(index, index + 500));
    } catch {
      failed = true;
    }
  }
  return !failed;
}
