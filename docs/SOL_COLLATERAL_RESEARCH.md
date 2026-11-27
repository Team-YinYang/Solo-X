# SOL-backed collateral: research proposal (#19)

Status: proposed, not approved. Post-MVP only; no production funds or changes to existing USDC mint/redeem. Independent economic, security and governance review is required before contract implementation.

## Economic model
Use isolated position PDAs and native SOL escrow (rent-exempt balance excluded), with debt denominated in six-decimal USD tokens. Each position binds owner, currency, vault and debt. SOL has nine decimals. Minting increases debt and supply atomically; repayment burns tokens and decreases debt. Transfers do not change debt. Unlike USDC, SOL redemption cannot promise a fixed number of lamports. No conversion into USDC-backed currencies under existing 1:1 rules. Define market-based repayment and liquidation, not guaranteed dollar redemption.

Illustrative parameters for simulation only: minimum issuance/withdrawal ratio 180%, liquidation threshold 150%, liquidation bonus 10%, maximum price age 60 seconds, confidence interval at most 2% of price. These are not calibrated or approved. Use conservative collateral value floor(lamports * (price - confidence) / 1e9), price in USD micro-units; compare integer products, no floating point. Debt zero is solvent. Example: $180 collateral / $100 debt meets issuance threshold; $149 collateral is liquidatable. Stress test gaps, congestion and correlated price drops before choosing parameters.

## Oracle
Pin provider program, feed ID, owner and expected SOL/USD denomination in governance configuration. Verify authenticated update, positive price, exponent normalization with checked arithmetic, publish time not in future, age <=60s and confidence <=2%; reject malformed or replayed updates older than last accepted timestamp. Use chain clock, not client clock. Pause mint, collateral withdrawal and liquidation when oracle invalid; allow debt repayment and collateral additions without price. Evaluate redundant independent feeds, divergence circuit breakers and outage recovery; no arbitrary fallback price. Oracle provider selection and feed IDs require separate review.

## Liquidation
Permissionless liquidators burn their own issued tokens against position debt and receive SOL at conservative oracle price plus bonus. Require unhealthy ratio strictly below 150%, positive repayment, debt and vault bounds, user-specified minimum SOL output and deadline. Round payout down, cap repayment at debt, cap payout at available collateral; do not burn more than the collateral-supported repayment in normal liquidation. Proposed full close permitted for small positions; otherwise assess close factor and dust limits during simulations. Recompute post-state; partial liquidation must improve ratio or enter explicit insolvency resolution, never silently increase risk. Atomic burn, debt update and SOL transfer; failed steps roll back. No cross-vault seizure. Avoid rewarding self-liquidation with protocol subsidies.

## Bad debt
When collateral cannot cover debt plus incentive, record residual debt explicitly; never erase it or pretend reserves are solvent. Halt new issuance for affected currency, preserve repayment and deposits. A separately funded insurance reserve may buy and burn tokens to retire debt; if insufficient, governance must approve transparent recapitalization or orderly settlement with disclosed losses. No automatic socialization across independent currencies, unbacked minting, or guaranteed peg. Reconcile total outstanding debt (including bad debt) against supply, accounting explicitly for voluntary external burns. Monitor reserve shortfall, oracle outages, concentration and liquidation backlog.

## Threat model
- Oracle spoofing/staleness/manipulation: pinned authenticated feed, freshness/confidence bounds, conservative valuation, circuit breakers.
- Price gaps and network congestion: overcollateralization, incentives, stress tests, debt ceilings and insurance; residual insolvency remains possible.
- Vault substitution or unauthorized withdrawals: canonical PDAs, signer and currency bindings, checked rent reserve, atomic instructions.
- Rounding/overflow: checked wide integer intermediates, conservative rounding, reject zero and dust; fuzz boundaries.
- Liquidator front-running: minimum payout, deadline, recheck price and position at execution.
- Governance compromise: multisig, timelock, limited emergency pause, audit trail and independent review. No unrestricted seizure.
- Concentration and liquidity risk: per-position/currency ceilings and monitoring; no assumption of instant liquidation.

## Validation and review gate
Run `node --test research/sol-collateral/model.test.cjs` for deterministic research vectors. Before implementation, reviewers must approve oracle provider, parameter calibration, liquidation close factors, insolvency policy, redemption economics and governance. Future validator tests must cover wrong feeds, stale prices, cross-vault substitution, overflow, rollback, concurrent liquidation and pause recovery. Simulate 20–80% price gaps, prolonged oracle outages, liquidator scarcity and insurance exhaustion. No production funds. See ARCHITECTURE.md and docs/PRODUCTION_READINESS.md.
