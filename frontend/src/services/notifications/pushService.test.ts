import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './pushService';

describe('push subscription key', () => {
  it('decodes a base64url VAPID public key into the 65 bytes PushManager expects', () => {
    const key = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});
