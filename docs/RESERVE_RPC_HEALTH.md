# Reserve and RPC health diagnostics (#35)

The workspace reserve panel provides read-only, devnet/local-validator-only checks of currency coverage and RPC freshness.

The panel verifies the currency state PDA, vault PDA and token account relationships before reporting a health status. Currency state, supply, reserves and collateral mint are read together in one RPC account snapshot, so amounts are not combined from different slots. A reserve shortfall is reported when reserves are below supply, with the exact missing amount.

Freshness is checked using the response slot against the latest confirmed slot (warning above 32 slots) and block timestamp against local time (warning above 90 seconds). Missing block time, network errors and unverifiable currency identity are marked unverified rather than healthy. Zero supply is displayed as N/A rather than pretending to have a meaningful reserve ratio.

Never treat these observations as an audit, collateral issuer guarantee, or production authorization. A compromised RPC may provide consistent but untrue figures. Refresh and verify using another test RPC when stale, shortfall or unverified warnings appear.

The diagnostics do not sign or submit transactions, record private keys, or expose RPC errors and potentially private URLs in logs.

Tests: npm ci; npm run lint --workspaces --if-present; npm run typecheck --workspaces --if-present; npm run build --workspaces --if-present; npm run test --workspaces --if-present. Live funded-validator testing remains manual.
