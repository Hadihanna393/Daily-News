// Prints the VAPID keypair as environment variables, for a host whose
// filesystem does not survive a redeploy. Run: npm run vapid:export
//
// These keys ARE the identity your subscribers trust. Treat the private one
// like a password: set it as a secret, never commit it.
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.env.DIGEST_DATA_DIR || 'data', 'vapid.json');

let keys;
try {
  keys = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch {
  console.error(`No keypair at ${file}. Start the server once to generate one.`);
  process.exit(1);
}

console.log('\nSet these two environment variables on your host:\n');
console.log('VAPID_PUBLIC_KEY');
console.log(keys.publicKey);
console.log('\nVAPID_PRIVATE_KEY   (base64 of the PEM — keep secret)');
console.log(Buffer.from(keys.privatePem, 'utf8').toString('base64'));
console.log(
  '\nKeeping these stable is what lets an already-installed phone keep receiving\n' +
    'notifications across redeploys. Change them and every device must re-enable.\n'
);
