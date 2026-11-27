# Solo-X governance and production-readiness policy

**Status: PRE-MVP / DEVNET ONLY — MAINNET NOT APPROVED.**

This policy is a review framework, not a claim that the program is audited, compliant,
operationally safe, or authorized to launch. In particular, anyone with the current
program upgrade authority can change program behavior, including asset handling.
Wallet signatures, source review and automated CI do not remove that trust.

## Ownership, upgrade authority and accountability

The maintainers must designate named people or teams and record approval evidence before
a production decision. Roles below are responsibilities to assign, not assertions
that named owners or controls already exist.

| Role | Responsibility | Independent check |
| --- | --- | --- |
| Protocol lead | Document upgrade-key custody and exact deployed program ID | Security lead verifies chain state |
| Security lead | Audit scope, threat model, remediation and release hash | Independent auditor reviews |
| Operations lead | Incident command, escalation, monitoring, rollback options | Separate on-call reviewer |
| Risk lead | Collateral issuer, liquidity, redemption and reserve risks | Reconciliation sign-off |
| Legal/compliance reviewer | Applicable-jurisdiction obligations and privacy | Qualified independent review |
| Maintainers | Record release decision, accept residual risk and coordinate communications | Approval trail in a reviewable record |

For every deployment, independently read the program's **actual** upgrade authority
from chain, compare it to the approved authority, program ID, network, build hash,
and deployment transaction. A repository statement is not proof of chain authority.

**Proposed production policy (not currently implemented):**
- Replace any individual upgrade-key custody with an independently approved
  multisig, signer roster and documented threshold. Do not invent or assume a
  current multisig or threshold.
- Require documented change proposals, independent security review and at least
  two separate human approvals for program upgrades; prohibit self-approval.
- Record signer rotation, secure backup/recovery, and lost/compromised signer
  procedures before launch.
- Enforce a published review window for routine upgrades, a tested emergency
  procedure, and a documented decision on whether authority will ever be revoked.
  Revocation is irreversible for an upgradeable program; do not describe a
  purported emergency upgrade as available after revocation.
- Review any program-owned token authorities, vault permissions, freeze
  authorities and collateral issuer privileges independently of upgrade custody.

## Explicit trust assumptions

1. **Upgradeable code:** the current upgrade authority can replace program logic.
   Never treat PDA derivation as protection against an authorized malicious upgrade.
2. **Collateral:** the supported devnet test-USDC mint is for tests. A future
   production collateral issuer may freeze, blacklist, change operational policies,
   or experience depegging or failed redemption. Equal token units are not
   guaranteed equal fiat value.
3. **RPC and user interface:** RPC endpoints can be stale, wrong or unavailable;
   UIs and SDKs can be compromised. Verify program IDs, token mints, transactions
   and reserve/supply against independent RPCs and raw chain state.
4. **Wallets and signers:** users remain responsible for approving transactions.
   Multisig governance reduces but does not eliminate key, collusion or social
   engineering risks.
5. **Reserve accounting:** `vault.amount >= mint.supply` is an on-chain
   accounting invariant, not proof of issuer solvency, fiat convertibility,
   price stability, or legal entitlement.
6. **Operational dependencies:** Solana liveness, transactions fees, third-party
   RPCs, service providers and wallet infrastructure can fail independently.
7. **Unimplemented features:** production monitoring, incident alerting, legal
   review, independent audits, and SOL-backed collateral controls are not
   supplied by this documentation.

## Mainnet launch gates — all must be met

The source-of-truth checklist is [launch-gates.json](launch-gates.json).
Every gate starts `approved: false` with empty evidence. Maintainers must attach
reviewable evidence links/commit hashes and document the accountable reviewer.
**No mainnet launch may be proposed or approved merely because CI passes.**

| Gate ID | Minimum approval evidence |
| --- | --- |
| `upgrade-authority` | Actual program ID and owner/upgrade authority verified on chain; approved multisig policy, signers, threshold, recovery and emergency authority procedure |
| `independent-audit` | External audit report tied to exact program hash, findings, fixes, independent retest and explicit acceptance of unresolved risks |
| `security-tests` | Pinned release build, required CI green, local-validator tests for funded mint/redeem/convert, rollback, unauthorized calls, reserves, and negative paths |
| `incident-response` | Named 24/7 contacts, private report intake, tabletop exercise and upgrade/emergency process |
| `collateral-risk` | Reserves and supply reconciled against independent chain RPCs; collateral issuer/freeze/depeg, liquidation applicability and redemption failure review |
| `legal-compliance` | Qualified reviewer signs off asset classification, jurisdiction, AML/KYC/sanctions applicability, consumer disclosures, privacy/data retention and regulatory obligations |
| `operations-monitoring` | Alert thresholds, reserve reconciliation, independent RPC quorum/verification, ownership, backups, key rotation and disaster recovery drills |
| `release-approval` | Named authorized maintainers sign version, build hash, release manifest, chain IDs, exact program address, residual risks, deployment and rollback/no-rollback plan |

Suggested commands from the repository root:

```bash
node .github/scripts/check-launch-gates.cjs
node --test .github/scripts/check-launch-gates.test.cjs
node .github/scripts/check-launch-gates.cjs --assert-mainnet
```

The last command **must return nonzero** in the current state. The checker verifies
the manifest's structure and whether approval/evidence fields are populated; it
**cannot verify** whether signatures, audits or compliance decisions are genuine.
A passing assertion is not permission to deploy. Any actual deployment workflow
must separately enforce approvals and stop before mainnet until the organization
implements its approved governance controls. This repository does not currently
contain a mainnet deployment workflow.

## Change management and release records

Every independent-audit finding must have a severity, owner, target date, remediation commit, retest evidence, and explicit disposition. Unresolved findings require written residual-risk acceptance by authorized maintainers; critical findings block launch.

1. Propose a change with threat-model impact, diff, target addresses and rationale.
2. Require peer review, static analysis, Rust/TS checks, and full validator tests.
3. For security-critical changes, request a fresh independent audit and retest.
4. Generate a reproducible build and record commit, artifact checksum, program ID,
   upgrade authority, deployment signature and network.
5. Collect explicit approvals from separate owners; never approve one's own change.
6. Verify the actual chain state after deployment with a second RPC endpoint.
7. Monitor supply/reserves, abnormal issuance, failures, privilege changes and
   alerts throughout the observation window.
8. Retain incident records and publish an appropriate public changelog.

## Incident response

**Before production**, establish a private security reporting channel and named
contacts; do not publish an unstaffed or fictitious email address.

| Severity | Examples | Initial action |
| --- | --- | --- |
| Critical | Unauthorized mint/withdrawal, compromised upgrade signer, active reserve deficit | Declare incident; escalate immediately; preserve evidence; coordinate any *authorized and reviewed* upgrade or service pause |
| High | Suspected frozen collateral, abnormal issuance, compromised API/RPC, exploitable authorization weakness | Escalate to protocol/security/operations leads; independently check chain state; assess transaction warning and change freeze |
| Moderate | Delayed redemption, monitoring blind spot, noncritical service outage | Triage, record impact, notify responsible maintainer and prioritize remediation |

**Workflow: detect → verify → contain → recover → review.**

- **Detect:** record block slot, program ID, transaction signatures, account states,
  incident time in UTC, independent RPC comparisons and relevant logs. Never log
  private keys or seed phrases.
- **Verify:** separate an RPC/UI anomaly from confirmed on-chain activity; check
  supply, vault balances, issuer status, authority changes and affected currencies.
- **Contain:** freeze *new product/UI activity* and warn users where possible.
  Do **not** claim a program pause, clawback, frozen funds or reversible transactions
  unless that capability is actually implemented and authorized. An upgrade
  requires control of the real authority and a tested procedure.
- **Communicate:** designate one incident commander and a trusted official update
  channel. Do not promise reimbursement or recovery without approval.
- **Recover:** obtain independent review and documented sign-offs before returning
  affected services to normal. Compromised keys require formal rotation and
  follow-up verification of on-chain authority.
- **Postmortem:** document timeline, scope, root cause, financial/operational impact,
  corrective actions, owners and target dates. Decide what must be publicly disclosed.

## Legal and compliance review

This policy is not legal advice and does not classify the issued assets. Before a
production proposal, qualified counsel must review intended jurisdictions,
asset/stablecoin/payment-service regulation, licensing, AML/KYC/sanctions
screening where applicable, tax treatment, privacy and consumer protection,
redemption claims, terms, and off-chain data retention. Document the actual
product behavior and limitations rather than presenting a legal conclusion.
Separate the open-source code release from operating a regulated service.

## Existing evidence and unclosed risks

- [Architecture](../ARCHITECTURE.md) describes the planned protocol.
- [Security tests](SECURITY_TESTS.md) contains partially automated adversarial
  coverage and expressly documents funded validator gaps.
- [CI](../.github/workflows/ci.yml) verifies Rust/TypeScript but is not an audit.
- The devnet test-USDC configuration in [Anchor.toml](../Anchor.toml) is not
  a mainnet collateral decision.
- Production multisig, audited build, legal sign-off, funded end-to-end tests,
  incident staffing and third-party monitoring remain **unverified and blocked**.

**Decision:** local validator/devnet only until independently reviewed launch
gates and authorized organizational approval are evidenced. No production funds.
