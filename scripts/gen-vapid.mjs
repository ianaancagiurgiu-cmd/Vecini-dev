// Generates a VAPID key pair for web push.
//
//   node scripts/gen-vapid.mjs
//
// The public key goes in the site build (VITE_VAPID_PUBLIC_KEY); the private
// key goes to Supabase as a secret and must never be committed.
// Regenerating invalidates every existing subscription — the app notices the
// mismatch and re-subscribes each device on next open.
import { generateKeyPairSync } from 'crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// The last 65 bytes of the SPKI DER encoding are the uncompressed P-256 point,
// which is exactly what the Push API wants as applicationServerKey.
const rawPublic = publicKey.export({ type: 'spki', format: 'der' }).subarray(-65);
const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

console.log('VAPID_PUBLIC_KEY  =', b64url(rawPublic));
console.log('VAPID_PRIVATE_KEY =', privateKey.export({ format: 'jwk' }).d);
