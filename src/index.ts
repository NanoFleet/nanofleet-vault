import { startMcpServer } from './mcp-server';
import { startRestApi } from './rest-api';

console.log('[nanofleet-vault] Starting...');

await Promise.all([startMcpServer(), startRestApi()]);

console.log('[nanofleet-vault] Ready');
