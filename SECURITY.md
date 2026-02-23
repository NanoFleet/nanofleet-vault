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

nanofleet-vault uses XOR+Base64 obfuscation keyed by `VAULT_ENCRYPTION_KEY` to protect secrets at rest. This provides obfuscation against casual inspection of the database file, but is **not** cryptographically strong encryption. Anyone with access to both the database and the `VAULT_ENCRYPTION_KEY` can recover all secret values.

The threat model assumes:
- The host running NanoFleet is trusted
- The database file (`/data/nanofleet-vault.db`) is not directly accessible to untrusted parties
- `VAULT_ENCRYPTION_KEY` is kept confidential

## Security Best Practices

- Only authorize trusted agents to access secrets
- Review agent permissions regularly
- Restrict access to the host and Docker volumes running the vault container
