import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function deriveKey(salt: Buffer): Buffer {
	const envKey = process.env.VAULT_ENCRYPTION_KEY;
	if (!envKey) throw new Error('VAULT_ENCRYPTION_KEY is not set');
	return pbkdf2Sync(envKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

// Layout: <hex-salt>:<base64(IV || CIPHERTEXT || AUTH_TAG)>

export function encrypt(text: string): string {
	const salt = randomBytes(SALT_BYTES);
	const iv = randomBytes(IV_BYTES);
	const key = deriveKey(salt);

	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([
		cipher.update(Buffer.from(text, 'utf8')),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	const payload = Buffer.concat([iv, ciphertext, authTag]).toString('base64');
	return `${salt.toString('hex')}:${payload}`;
}

export function decrypt(encrypted: string): string {
	const colonIdx = encrypted.indexOf(':');
	if (colonIdx === -1) throw new Error('Invalid encrypted value format');

	const salt = Buffer.from(encrypted.slice(0, colonIdx), 'hex');
	const data = Buffer.from(encrypted.slice(colonIdx + 1), 'base64');

	if (data.length < IV_BYTES + AUTH_TAG_BYTES) {
		throw new Error('Invalid encrypted payload');
	}

	const iv = data.subarray(0, IV_BYTES);
	const authTag = data.subarray(data.length - AUTH_TAG_BYTES);
	const ciphertext = data.subarray(IV_BYTES, data.length - AUTH_TAG_BYTES);

	const key = deriveKey(salt);
	const decipher = createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);

	return decrypted.toString('utf8');
}
