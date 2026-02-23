import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import { decrypt, encrypt } from './crypto';

const DB_PATH = '/data/nanofleet-vault.db';

let db: Database;

export function getDb(): Database {
	if (!db) {
		db = new Database(DB_PATH);
		db.exec('PRAGMA journal_mode=WAL;');
		db.exec('PRAGMA foreign_keys=ON;');
		initSchema();
	}
	return db;
}

function initSchema() {
	db.exec(`
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      encrypted_value TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secret_grants (
      secret_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      PRIMARY KEY (secret_id, agent_id)
    );
  `);
}

export interface SecretRow {
	id: string;
	name: string;
	description: string | null;
	encrypted_value: string;
	created_at: number;
	updated_at: number;
}

// ---- Secrets ----

export function createSecret(
	name: string,
	value: string,
	description: string | null,
	agentIds: string[],
): SecretRow {
	const db = getDb();
	const id = randomUUID();
	const now = Date.now();
	const encrypted_value = encrypt(value);

	db.run(
		'INSERT INTO secrets (id, name, description, encrypted_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
		[id, name, description ?? null, encrypted_value, now, now],
	);

	for (const agentId of agentIds) {
		db.run('INSERT INTO secret_grants (secret_id, agent_id) VALUES (?, ?)', [
			id,
			agentId,
		]);
	}

	return {
		id,
		name,
		description: description ?? null,
		encrypted_value,
		created_at: now,
		updated_at: now,
	};
}

export function listSecrets(): Array<SecretRow & { agentIds: string[] }> {
	const rows = getDb()
		.query('SELECT * FROM secrets ORDER BY name ASC')
		.all() as SecretRow[];
	return rows.map((row) => ({
		...row,
		agentIds: getGrantedAgents(row.id),
	}));
}

export function getSecretById(id: string): SecretRow | null {
	return (
		(getDb()
			.query('SELECT * FROM secrets WHERE id = ?')
			.get(id) as SecretRow) ?? null
	);
}

export function getSecretByName(name: string): SecretRow | null {
	return (
		(getDb()
			.query('SELECT * FROM secrets WHERE name = ?')
			.get(name) as SecretRow) ?? null
	);
}

export function updateSecret(
	id: string,
	fields: {
		name?: string;
		description?: string | null;
		value?: string;
		agentIds?: string[];
	},
): boolean {
	const db = getDb();
	const existing = getSecretById(id);
	if (!existing) return false;

	const now = Date.now();
	const name = fields.name ?? existing.name;
	const description =
		fields.description !== undefined
			? fields.description
			: existing.description;
	const encrypted_value =
		fields.value !== undefined
			? encrypt(fields.value)
			: existing.encrypted_value;

	db.run(
		'UPDATE secrets SET name = ?, description = ?, encrypted_value = ?, updated_at = ? WHERE id = ?',
		[name, description ?? null, encrypted_value, now, id],
	);

	if (fields.agentIds !== undefined) {
		db.run('DELETE FROM secret_grants WHERE secret_id = ?', [id]);
		for (const agentId of fields.agentIds) {
			db.run('INSERT INTO secret_grants (secret_id, agent_id) VALUES (?, ?)', [
				id,
				agentId,
			]);
		}
	}

	return true;
}

export function deleteSecret(id: string): boolean {
	const db = getDb();
	db.run('DELETE FROM secret_grants WHERE secret_id = ?', [id]);
	const result = db.run('DELETE FROM secrets WHERE id = ?', [id]);
	return result.changes > 0;
}

// ---- Grants ----

export function getGrantedAgents(secretId: string): string[] {
	const rows = getDb()
		.query('SELECT agent_id FROM secret_grants WHERE secret_id = ?')
		.all(secretId) as { agent_id: string }[];
	return rows.map((r) => r.agent_id);
}

export function isAgentAuthorized(secretId: string, agentId: string): boolean {
	const row = getDb()
		.query('SELECT 1 FROM secret_grants WHERE secret_id = ? AND agent_id = ?')
		.get(secretId, agentId);
	return row !== null;
}

// ---- MCP: read plaintext value ----

export function getDecryptedValue(secretId: string): string {
	const secret = getSecretById(secretId);
	if (!secret) throw new Error('Secret not found');
	return decrypt(secret.encrypted_value);
}
