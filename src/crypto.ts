function getKey(): Uint8Array {
  const envKey = process.env.VAULT_ENCRYPTION_KEY;
  if (!envKey) throw new Error('VAULT_ENCRYPTION_KEY is not set');
  const encoder = new TextEncoder();
  const keyStr = envKey.slice(0, 32).padEnd(32, '0');
  return encoder.encode(keyStr);
}

export function encrypt(text: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const key = getKey();
  const keyLen = key.length;

  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const dataByte = data[i];
    const keyByte = key[i % keyLen];
    if (dataByte !== undefined && keyByte !== undefined) {
      result[i] = dataByte ^ keyByte;
    }
  }

  return Buffer.from(result).toString('base64');
}

export function decrypt(encrypted: string): string {
  const data = Buffer.from(encrypted, 'base64');
  const key = getKey();
  const keyLen = key.length;

  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const dataByte = data[i];
    const keyByte = key[i % keyLen];
    if (dataByte !== undefined && keyByte !== undefined) {
      result[i] = dataByte ^ keyByte;
    }
  }

  return new TextDecoder().decode(result);
}
