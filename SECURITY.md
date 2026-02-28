# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please use [GitHub private security advisories](../../security/advisories/new) to report vulnerabilities confidentially. All reports will be addressed promptly.

Include as much of the following as possible:
- Type of vulnerability
- Affected source file(s) and location
- Steps to reproduce
- Proof-of-concept or exploit code (if available)
- Impact assessment

## Encryption Model

nanofleet-vault encrypts secrets at rest using **AES-256-GCM** with a unique random salt and IV per secret. The encryption key is derived from `VAULT_ENCRYPTION_KEY` via **PBKDF2-SHA256** (100,000 iterations, 16-byte random salt). The GCM auth tag provides integrity verification — any tampering with the ciphertext will cause decryption to fail. Anyone with access to both the database (or any of its backups/snapshots) and the `VAULT_ENCRYPTION_KEY` can recover all secret values.

The threat model assumes:
- The host running NanoFleet is trusted
- The database file (`/data/nanofleet-vault.db`) and any backups, snapshots, or replicas of it are **never** accessible to untrusted parties
- `VAULT_ENCRYPTION_KEY` is kept confidential

## Security Best Practices

- Only authorize trusted agents to access secrets
- Review agent permissions regularly
- Restrict access to the host and Docker volumes running the vault container
- Ensure strict filesystem and infrastructure controls so that the database file (`/data/nanofleet-vault.db`) and its backups/snapshots are only readable by trusted system components (for example: lock down backup targets, avoid sharing the volume with untrusted containers, and use storage-level encryption and access controls where available).
