# Metadata and independent audit gates

Currency display metadata is optional browser-local branding. Duplicate names and symbols are permitted; users must verify the displayed mint address. Only HTTPS image URLs ending in PNG, JPEG, WebP, or SVG are accepted. Metadata never changes a mint, vault, collateral, reserve, redemption right, or conversion compatibility.

Before any real funds, an independent auditor must review the exact commit/build/program hash and track every finding with severity, owner, remediation commit, retest evidence, and explicit residual-risk acceptance. The launch checklist in `docs/launch-gates.json` must include the audit report, remediation retest, and authorized approvals. A green CI run is not audit approval or mainnet authorization.
