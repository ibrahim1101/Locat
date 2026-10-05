import { TRPCError } from '@trpc/server';
const buckets = new Map<string, { count: number; reset: number }>();
export function limit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10000) for (const [name, item] of buckets) if (item.reset <= now) buckets.delete(name);
  const current = buckets.get(key);
  if (current && current.reset > now) {
    if (current.count >= maximum) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again later.' });
    current.count++;
  } else {
    if (buckets.size >= 20000) throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    buckets.set(key, { count: 1, reset: now + windowMs });
  }
}
