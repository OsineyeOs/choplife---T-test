# Choplife Republic — Forensic Audit Findings

**Assessment date:** 27 October 2026  
**Evidence inspected:** `remix-choplife-republic (20)(2).zip` (3.56 MB), included audit/security/deployment documents, the bundled operational JSON snapshot, archived screenshot batches, and Ezee Optimus screens.  
**Status:** Static source review and visual evidence review completed to this stage; runtime verification remains blocked because dependencies could not be installed in the available environment.

## 1. Executive assessment

The supplied archive is a substantial full-stack React/TypeScript + Express application with customer ordering, staff/POS workflows, payment routes, inventory/purchasing, CMS, reporting/accounting, dispatch, and test scripts. It also includes prior audit reports claiming that a range of critical defects were fixed and tests passed.

Those historical reports must not be treated as proof of the supplied archive's actual behaviour. Static inspection found material mismatches between several historical claims and the source currently in the ZIP. The most important is the online order endpoint: it calculates order values from client-supplied item prices and accepts a client-supplied discount, rather than deriving the order exclusively from authoritative catalogue prices and a validated promotion policy.

**Current recommendation: do not certify this ZIP as production-ready until the critical financial and catalogue-integrity findings below are fixed and dynamically tested.** This is a conservative recommendation based on code evidence, not a claim that the live website is necessarily running this exact archive.

## 2. Findings register

### CR-F01 — Critical: client controls online order item prices and discount
- **Classification:** Code-confirmed defect; dynamic reproduction pending.
- **Evidence:** `server.ts`, `POST /api/orders`, approximately lines 2575–2680. `computedItemsSum` is calculated from each submitted item's `price`/`unitPrice`; the request's `discount` is accepted up to the calculated subtotal; `calculatedTotal` is derived from those client-provided values.
- **Impact:** A caller can manipulate prices, submit unapproved discounts, or construct an order whose value does not match the published menu. This creates direct revenue leakage and corrupts sales, tax, inventory, and accounting records.
- **Required fix:** Resolve every submitted product/option against the server-side catalogue; validate publication status, active category, channel and branch availability; calculate unit price and permitted modifiers server-side; validate coupons/discount permissions server-side; calculate subtotal, fees, tax, and total exclusively from validated values. Reject unknown products and malformed quantities. Keep the order creation operation idempotent and atomic.
- **Verification required:** Negative-price/zero-price tests; tampered unit price; unknown product; inactive product/category; branch 86'd item; oversized discount; forged coupon; duplicate submission; branch-price override; legitimate modifiers and add-ons.

### CR-F02 — High: product/category deletion does not preserve referenced history in this archive
- **Classification:** Code-confirmed defect; dynamic reproduction pending.
- **Evidence:** `server.ts`, `DELETE /api/categories/:id` around lines 1624–1645 and `DELETE /api/menu/products/:id` around lines 1778–1802 directly delete records from their respective maps.
- **Impact:** Historical orders, POS checks, recipe/BOM references, or reporting can become difficult to interpret or reconcile after catalogue deletion. This conflicts with the historical audit report's claim that referenced records are archived rather than hard-deleted.
- **Required fix:** Block hard deletion whenever a record is referenced by an order, check, recipe/BOM, or other historical record. Provide an explicit archive/deactivate workflow and preserve historical display snapshots.
- **Verification required:** Attempt deletion of a referenced and unreferenced category/product; verify historical order, check, recipe, and report output afterwards.

### CR-F03 — High: CMS draft/publish isolation claimed in prior report is not present in the inspected route
- **Classification:** Code-confirmed discrepancy; dynamic behaviour pending.
- **Evidence:** `server.ts`, `GET /api/cms/content` and `PUT /api/cms/content` around lines 1479–1530. The GET route returns `db.cmsContent`; the PUT route directly mutates `db.cmsContent`, including fields supplied for hero, contact information, banners, articles, and status. The inspected implementation does not separate a draft store from a published store or create immutable revision snapshots in these handlers.
- **Impact:** A draft/edit operation may alter the live content before a deliberate publish action, and a clear rollback/version history is not demonstrated in this code path. This conflicts with historical documentation describing `cmsDraft`, `cmsRevisions`, and draft/publish isolation.
- **Required fix:** Implement separate draft and published content, enforce `content.edit` versus `content.publish` separately, validate content payloads, create immutable revisions at publish time, and provide rollback.
- **Verification required:** Save draft and confirm public GET is unchanged; publish and confirm public GET changes; reject publish for unauthorized role; verify revision and rollback.

### CR-F04 — High: staff bearer token is stored in browser localStorage
- **Classification:** Code-confirmed security risk.
- **Evidence:** `server.ts` returns the staff session token in the login response as well as setting an HttpOnly cookie. `src/context/AppContext.tsx` stores `data.token` as `choplife_staff_token` in localStorage; multiple staff/admin components read it and attach it as a Bearer token.
- **Impact:** Any successful same-origin script injection or compromised third-party script can read and exfiltrate the staff bearer token. The HttpOnly cookie does not protect a parallel token deliberately exposed to JavaScript. Session lifetime in the login handler is 12 hours.
- **Required fix:** Prefer an HttpOnly, Secure, SameSite cookie-only session design with CSRF protections appropriate to the chosen cookie strategy. Remove the token from JSON responses and remove localStorage token persistence. If bearer tokens are intentionally retained for offline/device requirements, document the threat model, reduce scope/lifetime, rotate on use where feasible, and ensure XSS protections are robust.
- **Verification required:** Login response contains no bearer secret; browser storage contains no staff token; authenticated API flows still work; logout and session revocation invalidate sessions.

### CR-F05 — High: static fallback secret is present for notification webhook configuration
- **Classification:** Code-confirmed security risk; production exploitability depends on deployment configuration and route use.
- **Evidence:** `server_db.ts` seeds a fixed `gatewayConfig.webhookSecret` when the stored configuration is absent, and `server.ts` contains fallback use of the same fixed value in notification gateway setup. The literal is intentionally not reproduced in this report.
- **Impact:** If the fallback remains active in a live environment, an external party who learns the source/default can potentially satisfy a webhook verification path that relies on this value.
- **Required fix:** Do not seed production webhook secrets. Require a high-entropy secret from environment/secret manager in production, fail closed if missing, rotate any previously used value, and verify signatures/authenticity for each webhook provider.
- **Verification required:** Production startup fails or disables the webhook when the secret is absent; wrong/missing signature rejected; valid signature accepted; replay behaviour verified.

### CR-F06 — High: historical readiness claims exceed what this archive independently proves
- **Classification:** Unverified claim / evidence mismatch.
- **Evidence:** `docs/audit/prioritized-defect-register.md`, `docs/security/remediation-report.md`, and `docs/security/production-deployment-checklist.md` contain broad statements that controls were fully verified and the system is production-ready. The source-level findings above contradict at least some of the claimed remediations in this ZIP.
- **Impact:** Release decisions based on those reports alone could overlook financial, historical-data, or security risks.
- **Required fix:** Reissue the report with a claim-to-source-to-test evidence matrix. Mark historical test output as historical unless rerun against the exact archive/commit hash.

### CR-F07 — High: production release verification could not be reproduced in this environment
- **Classification:** Verification blocker, not itself a code defect.
- **Evidence:** The ZIP includes `bun.lock` and test scripts, but no `node_modules`. `npm install --ignore-scripts --no-audit --no-fund` did not complete within the available execution window; no runtime suite was therefore run here.
- **Impact:** Build success, runtime boot, test counts, payment behaviour, and production readiness remain unverified by this review.
- **Required fix:** Install dependencies in a controlled environment using the project's intended package manager and lockfile; run lint/build plus all relevant tests; save command output, exit codes, commit/archive hash, and environment details.

### CR-F08 — Medium: JSON-file persistence is not equivalent to transactional database guarantees
- **Classification:** Architectural risk requiring load/concurrency/failure testing.
- **Evidence:** `server_db.ts` loads the operational database into an in-memory object and writes a complete JSON snapshot to a temporary file followed by rename. This protects against some partial-file writes but does not by itself provide multi-process coordination, row-level transactions, constraints, or safe concurrent mutation semantics.
- **Impact:** Multiple application instances or overlapping writes may overwrite newer state; a growing operational JSON file can also increase write latency and recovery complexity.
- **Required fix:** If operating a single Node process, enforce a single writer and test crash/restart behaviour. For multi-instance or growing production use, plan a transactional relational database with migrations, constraints, backups, and recovery drills. Do not migrate live records without a tested migration/rollback plan.

### CR-F09 — Medium: screenshot contains suspicious numeric content in homepage headline
- **Classification:** Visually confirmed in archived screenshot; source cause unconfirmed.
- **Evidence:** `Screenshot 2026-10-27 135520.png` shows the customer homepage headline followed by `1793105150232`. Exact string search in the supplied source ZIP did not locate that number.
- **Impact:** If present on the published storefront, this is a visible content defect and undermines trust. It may originate from live CMS data, preview state, or a runtime-injected value rather than the source archive.
- **Required fix:** Inspect the actual published homepage and CMS hero content; remove the numeric suffix at the source, then verify in a clean browser session and mobile viewport. Do not patch only the screenshot or hard-code a display workaround.

## 3. Ezee Optimus screenshot evidence

The archived screenshot `Screenshot 2026-10-27 120608(3).png` visibly shows eZee Optimus / Yanolja Cloud Solution on a Payment configuration page. The visible payment methods include bank transfer options, bank POS options (including Moniepoint and GTBank), cash, cheque, and credit-card-related entries. The property label shown in the screenshot is Choplife Republic — Sapele Branch.

This supports a practical comparison point: the in-house app must distinguish **payment method configured**, **payment initiated**, **payment confirmed**, **settlement/reconciliation**, and **refund/reversal**. A payment method appearing in a settings list is not evidence that an API integration or automated confirmation is active. The screenshot does not establish whether card processing, reconciliation, or reporting is enabled for each method.

The available screenshot batch also includes the Choplife customer storefront and staff back-office CMS. The CMS screenshot shows a green success banner saying changes were published. That visible banner must be verified against server-side draft/publish behaviour; the inspected source handler currently writes directly to `db.cmsContent`.

## 4. Comparison implications for the three external systems

- **Ezee Optimus:** Use the screenshot evidence as a real operational reference for payment configuration, outlet identity, and the existing POS vocabulary. Do not clone the whole vendor UI; translate relevant workflows into Choplife's own operational requirements and reconcile actual reports/receipts.
- **PHP POS:** Treat as a historical comparator only until the precise legacy product/version and its data exports or screenshots are mapped. Do not assume it is the same product just because its name contains “PHP POS.”
- **Chowdeck:** Keep it as a separate external sales/fulfilment channel. Reconcile Chowdeck orders, commissions/fees, payout amounts, refunds, and sales timing against Choplife records; do not add seller onboarding or marketplace commission features to Choplife's own app without explicit approval.

## 5. Immediate priority order

1. Fix CR-F01 (server-authoritative pricing, availability, and discounts).
2. Rotate any live or reusable staff credentials, webhook secrets, and session secrets that may have appeared in the archive or prior pasted logs. Do not copy them into tickets or reports.
3. Fix CR-F04 (remove bearer tokens from localStorage) and review XSS/CSP assumptions.
4. Fix CR-F02 (archive referenced catalogue records) and CR-F03 (real CMS draft/publish separation).
5. Reproduce the headline defect against the live public storefront and CMS.
6. Run the full test suite against the exact archive/commit and verify deployment persistence, backup/restore, webhook behaviour, and multi-branch isolation.
7. Build a reconciliation test pack for Ezee Optimus, Choplife, and Chowdeck: gross orders, discounts, taxes/fees, payment method, refunds, payout/settlement, inventory consumption, and reporting totals.

## 6. Verification ledger

| Work item | Status in this review |
|---|---|
| Inventory source ZIP and key documentation | Completed |
| Inspect Ezee Optimus payment screen | Completed (visual evidence) |
| Inspect storefront headline screenshot | Completed (visual evidence) |
| Static source review of order pricing, CMS, catalogue deletion, authentication, persistence | Completed to the findings listed above |
| Install dependencies | Attempted; timed out |
| TypeScript/lint | Not run |
| Build | Not run |
| Automated test suites | Not run |
| Live deployment/source parity | Not verified |
| Live payment gateway/webhook | Not tested; no real payment attempted |
| Production data changes or deployment | None performed |

## 7. Final conclusion

The archive has a broad feature surface and includes extensive tests and documentation, but the inspected implementation contains material gaps that contradict some of its own production-readiness claims. The strongest verified concern is that the public order-creation endpoint derives money values from client input. Until this and the other high-severity items are addressed and tested against the exact release candidate, the appropriate status is **“not yet independently verified for production release,”** not “ready for production.”
