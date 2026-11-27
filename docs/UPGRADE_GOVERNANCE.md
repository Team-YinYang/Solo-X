# Upgrade governance and emergency controls — proposed design

Status: localnet/devnet design only; no deployed multisig, timelock or pause is asserted. Independent maintainer/security review is pending. The existing program has no pause instruction; its upgrade authority can change code and therefore remains a trust assumption.

## Proposed authority and state machine

Use an independently audited on-chain governance executor as the sole upgrade authority. Proposed parameters for review: five independent signers, three distinct approvals excluding the proposer, 48-hour timelock for upgrades, signer rotation and resumption. A quorum may pause creation, minting and conversion immediately, but never redemption or ordinary SPL transfers. No emergency upgrade bypass, reserve withdrawal, confiscation or arbitrary freeze instruction. These are design choices, not approved policy.

Bind each proposal to network, program ID, governance epoch, nonce, action, exact instruction accounts and artifact digest. Verify signatures and current roster on chain; enforce trusted Clock time, unique approvals, cancellation and one-time execution. Invalidate outstanding proposals on signer rotation. Upgrade buffers must be controlled by the executor and verified against the reviewed artifact before execution; prevent buffer mutation after approval. The executor itself must not have an ungoverned upgrade path. A pause is a proposed program state flag, not an existing feature. Keep redemption checks and vault PDA authority unchanged.

## Threat model

| Threat | Mitigation / residual risk |
| --- | --- |
| Single compromised signer | Independent quorum; rotate through delayed proposal. Collusion remains possible. |
| Malicious upgrade or substituted buffer | Bind exact artifact and accounts, independent audit, delay and monitoring. Authorized malicious code can still seize assets. |
| Replay or stale approvals | Nonce, governance epoch, consumed state and current signer checks. |
| Emergency abuse | Pause only creation/mint/conversion; delayed resumption; no seizure or redemption pause. |
| Lost quorum | No unilateral recovery bypass; prearranged secure signer backups and independent recovery review. Permanent loss may block upgrades. |
| Collateral freeze or insolvency | Monitor and disclose; redemption may fail despite no governance pause. |

## Recovery procedure

1. Declare incident privately; record slot, signatures, program authority and reserve/supply snapshots from independent RPCs.
2. Verify scope; stop affected UI activity. If the proposed on-chain pause has actually been deployed, collect quorum for its narrow activation; otherwise do not claim on-chain containment.
3. Isolate compromised signer devices, preserve evidence, and propose delayed signer rotation if quorum remains. If quorum is lost, escalate to maintainers; do not invent a bypass.
4. Review exact patch and build digest independently; execute only after quorum and delay, verify deployed authority and artifact, and rehearse funded redemption and accounting tests on devnet.
5. Propose delayed resumption after reconciliation and independent sign-off; publish incident disclosure and residual risks.

## Redemption disclosure

The design does not permit governance to pause redemption, but redemption is not guaranteed: insufficient reserves, issuer freezes, network outages, invalid accounts and malicious upgrades may prevent it. Current code has no emergency pause. No mainnet authorization or real funds.

## Tests and review gate

The reference JavaScript policy checks quorum, delay, invalid/replayed proposals and operation scope. It is not a signature verifier, digest binding implementation or on-chain executor. Run `node --test .github/scripts/governance-policy.test.cjs`. Existing CI invokes these tests through the launch-gate suite. Before deployment, independently review this threat model and recovery procedure, select and audit the executor, test real signatures, clock, replay, rotation, buffer binding and pause/redemption behavior on a validator, and record reviewer names and evidence. No review or launch gate is marked approved by this change.
