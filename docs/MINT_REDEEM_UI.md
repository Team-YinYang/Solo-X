# Mint and redeem workspace

Connect a test wallet, enter an existing Solo-X issued mint and refresh balances. Both initialized standard SPL token accounts must already exist. The UI selects the largest available account for each mint; it does not aggregate or create accounts. Enter a positive amount with up to six decimals and approve the transaction in the wallet. Confirmed transactions refresh balances; uncertain submissions display the signature and must be checked before retrying.

Use devnet or a loopback local validator only. Run npm ci, npm run lint --workspaces --if-present, npm run typecheck --workspaces --if-present, npm run build --workspaces --if-present and npm run test --workspaces --if-present. Manually verify mint, redeem, rejected signature, insufficient balance, wrong network and RPC failure using test funds. Browser wallet and validator integration have not been verified here.
