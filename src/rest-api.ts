import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
	createSecret,
	deleteSecret,
	getGrantedAgents,
	listSecrets,
	updateSecret,
} from './db';

const NANO_API_URL =
	process.env.NANO_API_URL ?? 'http://host.docker.internal:3000';
const NANO_INTERNAL_TOKEN = process.env.NANO_INTERNAL_TOKEN ?? '';
const REST_API_PORT =
	process.env.REST_API_PORT !== undefined
		? Number(process.env.REST_API_PORT)
		: 8822;

function nanoHeaders() {
	return {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${NANO_INTERNAL_TOKEN}`,
	};
}

export function createRestApp(): Hono {
	const app = new Hono();
	app.use('*', cors());

	// Serve frontend
	app.get('/', async () => {
		try {
			const html = Bun.file('/app/src/frontend/index.html');
			const exists = await html.exists();
			if (!exists || html.size === 0) {
				return new Response('Frontend index file not found.', { status: 500 });
			}
			return new Response(html, { headers: { 'Content-Type': 'text/html' } });
		} catch {
			return new Response('Failed to load frontend index file.', {
				status: 500,
			});
		}
	});

	// Proxy: list running agents from NanoFleet
	app.get('/agents', async (c) => {
		try {
			const res = await fetch(`${NANO_API_URL}/internal/agents`, {
				headers: nanoHeaders(),
				signal: AbortSignal.timeout(5000),
			});
			if (!res.ok) return c.json({ error: 'Failed to fetch agents' }, 502);
			const data: unknown = await res.json();
			if (
				!data ||
				typeof data !== 'object' ||
				!('agents' in data) ||
				!Array.isArray((data as { agents: unknown }).agents)
			) {
				return c.json({ error: 'Invalid response from NanoFleet' }, 502);
			}
			const agents = (data as { agents: Array<{ status?: string }> }).agents;
			const running = agents.filter((a) => a.status === 'running');
			return c.json({ agents: running });
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				return c.json(
					{ error: 'Request to NanoFleet timed out after 5 seconds' },
					504,
				);
			}
			return c.json({ error: 'Failed to fetch agents' }, 500);
		}
	});

	// GET /secrets — list all (no values)
	app.get('/secrets', (c) => {
		// Intentionally omit encrypted_value from the response for security reasons
		const secrets = listSecrets().map(({ encrypted_value, ...rest }) => rest);
		return c.json({ secrets });
	});

	// POST /secrets — create
	app.post('/secrets', async (c) => {
		let body: {
			name?: string;
			description?: string;
			value?: string;
			agentIds?: string[];
		};
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: 'Invalid JSON' }, 400);
		}

		const { name, value, description, agentIds } = body;
		if (!name || !value)
			return c.json({ error: 'name and value are required' }, 400);

		try {
			const secret = createSecret(
				name,
				value,
				description ?? null,
				agentIds ?? [],
			);
			const { encrypted_value: _v, ...safe } = secret;
			return c.json({ secret: { ...safe, agentIds: agentIds ?? [] } }, 201);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('UNIQUE constraint')) {
				return c.json(
					{ error: `A secret named "${name}" already exists` },
					409,
				);
			}
			return c.json({ error: msg }, 500);
		}
	});

	// PUT /secrets/:id — update (value optional — omit to keep existing)
	app.put('/secrets/:id', async (c) => {
		const id = c.req.param('id');

		let body: {
			name?: string;
			description?: string | null;
			value?: string;
			agentIds?: string[];
		};
		try {
			body = await c.req.json();
		} catch {
			return c.json({ error: 'Invalid JSON' }, 400);
		}

		try {
			const updated = updateSecret(id, body);
			if (!updated) {
				return c.json({ error: 'Secret not found' }, 404);
			}
			const agentIds = getGrantedAgents(id);
			const { encrypted_value: _v, ...safe } = updated;
			return c.json({ secret: { ...safe, agentIds } });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('UNIQUE constraint')) {
				return c.json(
					{ error: `A secret named "${body.name}" already exists` },
					409,
				);
			}
			return c.json({ error: msg }, 500);
		}
	});

	// DELETE /secrets/:id
	app.delete('/secrets/:id', (c) => {
		const deleted = deleteSecret(c.req.param('id'));
		if (!deleted) return c.json({ error: 'Secret not found' }, 404);
		return c.json({ ok: true });
	});

	return app;
}

export async function startRestApi(): Promise<void> {
	const app = createRestApp();

	Bun.serve({
		port: REST_API_PORT,
		fetch: app.fetch,
	});

	console.log(`[REST] Server listening on :${REST_API_PORT}`);
}
