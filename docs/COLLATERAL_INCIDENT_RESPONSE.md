# Collateral depeg and issuer freeze response (#36)

Status: proposed post-MVP research; not an implemented on-chain control. Local validator/devnet only. No production funds or launch approval. Follow [architecture](../ARCHITECTURE.md) and [production readiness](PRODUCTION_READINESS.md).

## Economic and operational distinction
The MVP redeems one issued base unit for one collateral base unit, subject to available reserves and successful token transfers. Unit coverage does not guarantee dollar value, issuer solvency or fiat redemption. A vault holding 100 USDC against 100 issued tokens remains unit-covered if USDC trades at $0.80; indicative collateral market value is then $80, not $100. An issuer-frozen vault can remain unit-covered but inaccessible. Never label either case guaranteed dollar backing.

## Proposed response matrix
| Observation | UI mint/convert | UI redemption | Disclosure |
|---|---|---|---|
| Verified normal conditions | Available | Available subject to transaction checks | Collateral units, not guaranteed USD |
| Confirmed depeg | Suspend | Allow voluntary redemption in collateral units if transferable and solvent | Market value may differ from $1 |
| Issuer freeze or blocked transfer | Suspend | Disable affected route | Collateral may be inaccessible; no recovery guarantee |
| Reserve deficit | Suspend | Disable affected route pending reviewed resolution | Unit shortfall; no first-come payout promise |
| Unknown/stale price | Suspend | Permit collateral-unit redemption only if chain state verified and transferable | Price unavailable |
| Unverified chain state/RPC outage | Suspend | Suspend | Reserve and transfer status unknown |

Multiple incidents apply the most restrictive action. These are proposed UI/service decisions, not contract enforcement. Direct program calls and ordinary SPL transfers may remain possible. Existing atomic transactions should fail and roll back if collateral transfer fails; never burn tokens off-chain in anticipation of payout. Do not attempt to evade issuer restrictions or seize another currency's vault.

## Detection and escalation
Risk lead compares independent market sources and issuer status; operations/security leads compare independent RPCs, canonical mint/vault state, frozen token-account flags, supply, transfer failures and timestamps. Illustrative alert threshold: outside 0.99–1.01 USD (9900–10100 basis points); exact boundaries included. Price observations must be fresh, independently corroborated and attributable; provider, age limit and persistence window require approval. Unknown or conflicting evidence is not normal. Freeze suspicion or unverified transferability must be represented as unverified chain status until resolved. The reference model consumes reviewed observations, not raw oracle data.

Record UTC time, slot, network, affected currencies, source evidence and incident owner. Escalate freeze/depeg to risk, security and operations leads; reserve deficit is critical. Stop affected new UI activity and publish a warning. No automatic contract upgrade, pause, clawback, reimbursement or cross-vault rescue is authorized. Preserve evidence without credentials or personal data.

## User disclosures
Normal: "Your currency is redeemable in collateral token units subject to available reserves and successful transfers. Its dollar value is not guaranteed."
Depeg: "The backing asset has moved away from its reference price. Redemption, where available, returns collateral tokens, not guaranteed dollars."
Freeze: "Collateral transfers may be blocked by the issuer. Redemption may fail even when the vault balance covers supply. Recovery timing is unknown."
Unverified: "Current collateral status cannot be verified. Some actions are unavailable until verification succeeds."
Deficit: "On-chain reserves are below outstanding supply. Recovery and settlement require review; no reimbursement is promised."

## Recovery and review
Do not automatically reopen on one good price observation. Require independent confirmation of sustained price recovery, transferable collateral, reconciled supply/vault balances and resolved incident causes; risk/security/operations sign off and publish status. If freeze persists, pursue lawful issuer resolution and independently reviewed settlement options; no guaranteed recovery or socialized losses. Record postmortem and evidence. All production controls require governance and independent audit approval.

## Tests
Run node --test research/collateral-response/model.test.cjs. The deterministic model tests normal, boundary, depeg, freeze, deficit, unknown and combined cases. Future validator exercises must test frozen vault/destination accounts, atomic rollback, RPC outage and recovery approval. No production funds. This research does not implement monitoring, an oracle, or a contract pause.
