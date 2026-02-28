import { pbkdf2Sync, randomBytes } from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;

function deriveKey(salt: Buffer): Buffer {
	const envKey = process.env.VAULT_ENCRYPTION_KEY;
	if (!envKey) throw new Error('VAULT_ENCRYPTION_KEY is not set');
	return pbkdf2Sync(envKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encrypt(text: string): string {
	const salt = randomBytes(SALT_BYTES);
	const key = deriveKey(salt);
	const encoder = new TextEncoder();
	const data = encoder.encode(text);

	const result = new Uint8Array(data.length);
	for (let i = 0; i < data.length; i++) {
		const dataByte = data[i];
		const keyByte = key[i % KEY_LENGTH];
		if (dataByte !== undefined && keyByte !== undefined) {
			result[i] = dataByte ^ keyByte;
		}
	}

	return `${salt.toString('hex')}:${Buffer.from(result).toString('base64')}`;
}

export function decrypt(encrypted: string): string {
	const colonIdx = encrypted.indexOf(':');
	if (colonIdx === -1) throw new Error('Invalid encrypted value format');
	const salt = Buffer.from(encrypted.slice(0, colonIdx), 'hex');
	const key = deriveKey(salt);
	const data = Buffer.from(encrypted.slice(colonIdx + 1), 'base64');

	const result = new Uint8Array(data.length);
	for (let i = 0; i < data.length; i++) {
		const dataByte = data[i];
		const keyByte = key[i % KEY_LENGTH];
		if (dataByte !== undefined && keyByte !== undefined) {
			result[i] = dataByte ^ keyByte;
		}
	}

	return new TextDecoder().decode(result);
}
