# Security policy and private reporting

**Solo-X is pre-MVP, unaudited and intended for local validator/devnet use only.**
Do not deposit or solicit real funds. No mainnet security guarantees are offered.

## Reporting vulnerabilities

Please do **not** publish exploitable vulnerabilities, private keys, seed phrases,
attack transaction details, or sensitive incident evidence in a public GitHub issue.
Use GitHub's private vulnerability reporting feature **if it is enabled** for the
repository, or contact repository maintainers through an existing private,
authenticated communication channel. Do not assume this project has a staffed
security inbox or guaranteed response SLA.

Include affected commit/program ID, environment, impact, reproduction steps,
transaction signatures (if safe), and suggested remediation. Never share secrets.
Maintainers should acknowledge privately, assign an incident owner, assess
severity, preserve evidence, coordinate a fix and retest, and agree on a safe
disclosure timeline with the reporter.

For a confirmed active incident, follow the
[incident-response procedure](docs/PRODUCTION_READINESS.md#incident-response).

## Supported deployments and disclosure

| Deployment | Support |
| --- | --- |
| Local validator / devnet | Development and testing only |
| Solana mainnet-beta | **Not approved; no supported production release** |

Read [governance and production readiness](docs/PRODUCTION_READINESS.md) and
[launch gates](docs/launch-gates.json). Passing tests does not confer launch
approval or substitute for an external audit.
