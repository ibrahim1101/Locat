export function scheduledKeyMaterial(conversationId: number, members: { id: number; publicKey: string }[]): string {
  return JSON.stringify([conversationId, members.map(({ id, publicKey }) => ({ id, publicKey })).sort((a, b) => a.id - b.id)]);
}
export async function scheduledKeyContext(conversationId: number, members: { id: number; publicKey: string }[]): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(scheduledKeyMaterial(conversationId, members)));
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
}
