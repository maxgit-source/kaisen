const fs = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');

const keysDir = path.join(__dirname, '..', 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const privPath = path.join(keysDir, 'license_private.pem');
const pubPath = path.join(keysDir, 'license_public.pem');

fs.writeFileSync(privPath, privateKey, 'utf8');
fs.writeFileSync(pubPath, publicKey, 'utf8');

console.log('Claves generadas:');
console.log(privPath);
console.log(pubPath);
