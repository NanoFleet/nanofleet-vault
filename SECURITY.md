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

nanofleet-vault uses XOR+Base64 obfuscation keyed by `VAULT_ENCRYPTION_KEY` to protect secrets at rest. This provides limited obfuscation against casual inspection of the database file, but is **not** cryptographically strong encryption and should **not** be relied on if an attacker can obtain a copy of the database. **This mechanism is vulnerable to cryptanalysis and must not be used to protect sensitive or regulated data in production environments.** Anyone with access to both the database (or any of its backups/snapshots) and the `VAULT_ENCRYPTION_KEY` can recover all secret values. For strong protection at rest, use an industry-standard encryption solution (for example, AES-256-GCM via a dedicated secrets management system or hardware security module).

The threat model assumes:
- The host running NanoFleet is trusted
- The database file (`/data/nanofleet-vault.db`) and any backups, snapshots, or replicas of it are **never** accessible to untrusted parties
- `VAULT_ENCRYPTION_KEY` is kept confidential

## Security Best Practices

- Only authorize trusted agents to access secrets
- Review agent permissions regularly
- Restrict access to the host and Docker volumes running the vault container
- Ensure strict filesystem and infrastructure controls so that the database file (`/data/nanofleet-vault.db`) and its backups/snapshots are only readable by trusted system components (for example: lock down backup targets, avoid sharing the volume with untrusted containers, and use storage-level encryption and access controls where available).
