import { startMcpServer } from './mcp-server';
import { startRestApi } from './rest-api';

if (!process.env.VAULT_ENCRYPTION_KEY)
	throw new Error('VAULT_ENCRYPTION_KEY environment variable must be set');

console.log('[nanofleet-vault] Starting...');

await Promise.all([startMcpServer(), startRestApi()]);

console.log('[nanofleet-vault] Ready');
