/**
 * generate-keys.js -- creates the RSA-2048 signing keypair used by the mock IdP.
 *
 * Idempotent: if keys/private.pem and keys/public.pem already exist, it does
 * nothing and says so. Delete the files to force a fresh keypair.
 *
 *   node generate-keys.js      (or: npm run keys)
 */
const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

function main() {
  fs.mkdirSync(KEYS_DIR, { recursive: true });

  const privateExists = fs.existsSync(PRIVATE_KEY_PATH);
  const publicExists = fs.existsSync(PUBLIC_KEY_PATH);

  if (privateExists && publicExists) {
    console.log('[mock-idp] keys already exist, doing nothing:');
    console.log('           ' + PRIVATE_KEY_PATH);
    console.log('           ' + PUBLIC_KEY_PATH);
    console.log('[mock-idp] delete both files and re-run to rotate the keypair.');
    return;
  }

  if (privateExists !== publicExists) {
    console.error('[mock-idp] refusing to run: exactly one of the key files exists.');
    console.error('           private.pem: ' + (privateExists ? 'present' : 'missing'));
    console.error('           public.pem : ' + (publicExists ? 'present' : 'missing'));
    console.error('[mock-idp] delete the leftover file and re-run.');
    process.exitCode = 1;
    return;
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

  console.log('[mock-idp] generated a fresh RSA-2048 keypair:');
  console.log('           ' + PRIVATE_KEY_PATH + '  (signs tokens)');
  console.log('           ' + PUBLIC_KEY_PATH + '   (published at /jwks.json)');
}

main();
