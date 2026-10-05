import { describe, expect, it } from 'vitest';
import { allowedPushEndpoint, endpointHash } from '../../api/push';
describe('push destination validation', () => {
  it('allows browser providers and rejects local, arbitrary, and deceptive destinations', () => {
    for (const url of ['https://fcm.googleapis.com/fcm/send/token','https://updates.push.services.mozilla.com/wpush/v2/token','https://web.push.apple.com/token','https://wns2.notify.windows.com/token']) expect(allowedPushEndpoint(url)).toBe(true);
    for (const url of ['http://fcm.googleapis.com/token','https://127.0.0.1/token','https://localhost/token','https://fcm.googleapis.com.evil.example/token','https://user:password@fcm.googleapis.com/token','https://fcm.googleapis.com:3000/token','https://evil.example/token','not-a-url']) expect(allowedPushEndpoint(url)).toBe(false);
  });
  it('uses stable endpoint identifiers without storing them in logs', () => {
    expect(endpointHash('https://fcm.googleapis.com/token')).toHaveLength(64);
    expect(endpointHash('one')).not.toBe(endpointHash('two'));
  });
});
