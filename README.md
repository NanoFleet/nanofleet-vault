# nanofleet-vault

A [NanoFleet](https://github.com/NanoFleet/nanofleet) plugin that provides a secret manager with per-agent access control. Store API keys, tokens, and passwords securely — agents can only retrieve secrets they are explicitly authorized to access.

## Features

- Secrets encrypted at rest (XOR+base64, keyed by a unique `VAULT_ENCRYPTION_KEY` auto-generated at install)
- Per-secret agent whitelist
- Web UI to manage secrets and agent assignments
- MCP tool for agent access

## MCP Tool

<details>
<summary><code>get_secret</code> — Retrieve a secret value you are authorized to access</summary>

**Input:**
```json
{ "name": "GITHUB_TOKEN" }
```

**Response (authorized):**
```json
{ "name": "GITHUB_TOKEN", "value": "ghp_..." }
```

**Response (unauthorized or not found):**
```json
{ "error": "You are not authorized to access this secret" }
```

> **Critical rules for agents:**
> - Only call `get_secret` when you actually need the value for a task
> - Never log, print, or include secret values in messages or results visible to others

</details>

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/secrets` | List all secrets (name, description, authorized agents — no values) |
| `POST` | `/secrets` | Create a secret `{ name, value, description?, agentIds[] }` |
| `PUT` | `/secrets/:id` | Update a secret (omit `value` to keep existing) |
| `DELETE` | `/secrets/:id` | Delete a secret |
| `GET` | `/agents` | List running agents (proxy to NanoFleet) |

## Ports

| Port | Service |
|------|---------|
| `8822` | REST API + Web UI |
| `8823` | MCP server |

## Installation

Install via the NanoFleet Plugins page using the manifest URL:

```
https://raw.githubusercontent.com/NanoFleet/nanofleet-vault/main/manifest.json
```

NanoFleet will automatically:
- Pull and start the Docker container
- Generate a unique `VAULT_ENCRYPTION_KEY` for encryption at rest
- Link the plugin to all existing agents

## Docker image

Built and pushed automatically to GHCR on every merge to `main`:

```
ghcr.io/nanofleet/nanofleet-vault:latest
```
