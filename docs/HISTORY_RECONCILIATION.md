# History and reserve reconciliation (#31)

Use the workspace activity panel with an issued mint on devnet or local validator. Confirmed signatures referencing its canonical currency state are paginated in groups of 20 using the last signature as an exclusive cursor. Failed transactions are labeled; this is account activity, not a decoded instruction ledger or complete SPL transfer history. RPC retention may truncate history. Retry a failed page without advancing the cursor. Changing mint clears prior results.

Supply and vault balances are independently read in one RPC context, with canonical state and token account checks. The slot is displayed; surplus and deficit use exact integer base units. History is never a source of reserve truth. Direct burns and donations can produce surplus. RPC failures clear reserve results rather than presenting stale balances as current. No production funds.

Run npm run test --workspace @solo-x/web; also run workspace lint, typecheck and build. On a test validator create a currency, mint/redeem, refresh, load additional pages and simulate RPC interruption. Compare supply and vault with direct account reads.
