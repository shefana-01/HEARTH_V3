// Creates the key pair Hearth signs Web Push messages with (VAPID, RFC 8292). Run it once:
//
//   node tools/vapid-keys.mjs
//
// and put the two lines it prints into your .env file. Keep the private key secret. If you change the
// keys later, every device has to turn push notifications on again.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwkPublic = publicKey.export({ format: 'jwk' });
const jwkPrivate = privateKey.export({ format: 'jwk' });
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwkPublic.x, 'base64url'), Buffer.from(jwkPublic.y, 'base64url')]);

console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwkPrivate.d}`);
