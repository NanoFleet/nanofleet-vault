import { AsyncLocalStorage } from 'node:async_hooks';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { getDecryptedValue, getSecretByName, isAgentAuthorized } from './db';

const agentIdStorage = new AsyncLocalStorage<string>();

export function getCallerAgentId(): string {
	return agentIdStorage.getStore() ?? 'unknown';
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: 'nanofleet-vault',
		version: '0.0.1',
	});

	// --- tool: get_secret ---
	server.tool(
		'get_secret',
		'Retrieve a secret value you are authorized to access.',
		{
			name: z.string().describe('The name of the secret (e.g. "GITHUB_TOKEN")'),
		},
		async ({ name }) => {
			const agentId = getCallerAgentId();

			const secret = getSecretByName(name);
			if (!secret) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ error: `Secret "${name}" not found` }),
						},
					],
					isError: true,
				};
			}

			if (!isAgentAuthorized(secret.id, agentId)) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({
								error: 'You are not authorized to access this secret',
							}),
						},
					],
					isError: true,
				};
			}

			const value = getDecryptedValue(secret.id);
			return {
				content: [
					{ type: 'text', text: JSON.stringify({ name: secret.name, value }) },
				],
			};
		},
	);

	return server;
}

// ---------------------------------------------------------------------------
// Start MCP HTTP server on port 8823
// ---------------------------------------------------------------------------

export async function startMcpServer(): Promise<void> {
	const server = createMcpServer();
	const sessions = new Map<
		string,
		{ transport: WebStandardStreamableHTTPServerTransport; agentId: string }
	>();

	Bun.serve({
		port: 8823,
		fetch: async (req) => {
			const url = new URL(req.url);
			if (url.pathname !== '/mcp') {
				return new Response('Not found', { status: 404 });
			}

			const agentIdFromUrl = url.searchParams.get('agent_id') ?? 'unknown';
			const sessionId = req.headers.get('mcp-session-id');

			if (req.method === 'DELETE' && sessionId) {
				sessions.delete(sessionId);
				return new Response(null, { status: 204 });
			}

			if (sessionId && sessions.has(sessionId)) {
				const { transport, agentId: sessionAgentId } = sessions.get(sessionId)!;
				return agentIdStorage.run(sessionAgentId, () =>
					transport.handleRequest(req),
				);
			}

			const transport = new WebStandardStreamableHTTPServerTransport({
				sessionIdGenerator: () => crypto.randomUUID(),
				enableJsonResponse: true,
				onsessioninitialized: (sid) => {
					sessions.set(sid, { transport, agentId: agentIdFromUrl });
				},
				onclose: () => {
					if (transport.sessionId) sessions.delete(transport.sessionId);
				},
			});

			await server.connect(transport);

			return agentIdStorage.run(agentIdFromUrl, () =>
				transport.handleRequest(req),
			);
		},
	});

	console.log('[MCP] Server listening on :8823');
}
