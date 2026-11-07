# Choplife Republic — Latest Source Review & Remediation Checkpoint

**Source reviewed:** `remix-choplife-republic (23).zip`  
**Source extracted to:** `latest_23/`  
**Working copy:** `remediated_working_copy/`  
**Review date:** 27 October 2026  
**Scope:** Static review and targeted security remediation. No production deployment or live merchant account was accessed.

## Executive summary

The uploaded archive is newer than the previously audited snapshot. Its `server.ts` is 329,530 bytes and includes several remediation items described in the earlier checkpoint, including authoritative catalogue price calculation, CMS draft state, and referential-integrity checks for menu deletion.

The review also found remaining order-integrity risks. A working copy was created, leaving the uploaded archive and the first extracted copy unchanged. Targeted changes were made to the working copy and checked with a small dependency-free static regression script.

## Changes made in the working copy

### 1. Order pricing and catalogue validation
- Public storefront orders now reject items that cannot be resolved by stable catalogue ID, instead of accepting arbitrary client-named items and prices.
- For known catalogue products, the server now replaces the submitted unit price with the catalogue's selected-branch base price plus validated catalogue add-ons. It no longer merely raises a price when the submitted value is too low.
- Unmatched add-ons are rejected instead of allowing a client-supplied add-on price.
- Item quantities must be integers from 1 through 100; malformed, fractional, zero, negative, or excessive quantities are rejected.
- Anonymous requests cannot claim the `pos_counter` channel.
- Client-supplied discounts are ignored for public orders. In this build, discounts are only honoured for an authenticated POS session whose staff role is in the existing executive/management allow-list. A server-side coupon/promotion catalogue was not found in this archive.

**Important remaining limitations:** This is not a full checkout redesign. Packaging-fee configuration still needs a server-side source of truth, and delivery-zone handling should be tested against the actual storefront and branch rules. Staff discount authority should be aligned with the formal role/permission matrix before release.

### 2. Hard-coded webhook verification secret
- Removed the literal fallback secret from `server.ts` and `server_db.ts` seed defaults.
- New defaults use `WHATSAPP_WEBHOOK_VERIFY_TOKEN` or an empty value, rather than a predictable built-in secret.

**Important deployment step:** Configure a high-entropy secret in the production environment and rotate any previously used value. Confirm webhook handlers fail closed when no secret is configured. Existing persisted database records may still contain an older secret; this archive did not include the live operational database, so its stored value was not changed or verified.

### 3. Existing controls confirmed in the uploaded source
- CMS editing can save to `db.cmsDraft` separately from the live `db.cmsContent`.
- Referenced menu products are archived rather than hard-deleted.
- Category deletion checks assigned products and blocks unsafe deletion unless the archive path is used.
- Payment status for public checkout is derived server-side rather than trusting a client claim of `paid`.

## Verification performed

- **10/10 dependency-free static regression checks passed** using `node scripts/static_security_regression_check.cjs` in the working copy.
- Dependency installation (`npm install --ignore-scripts --no-audit --no-fund --prefer-offline`) timed out after 120 seconds.
- Therefore **the TypeScript build, lint, and full runtime/test suites have not been re-run against this working copy**. The historical test claims in the uploaded notes are not represented here as newly reproduced results.

## Modified files in the working copy

- `server.ts`
- `server_db.ts`
- `scripts/static_security_regression_check.cjs` (new)

No production deployment, live payment action, live database migration, or merchant-account modification was performed. The original uploaded ZIP remains unchanged.

## Recommended release gates

1. Install dependencies successfully in the intended build environment.
2. Run `npm run lint` and `npm run build`.
3. Run the existing order, CMS, inventory, interface/RBAC, accounting, defect and production-release-gate test suites.
4. Add runtime tests proving that forged prices, unknown product IDs, unknown add-ons, forged discounts, invalid quantities, and anonymous `pos_counter` requests are rejected.
5. Confirm packaging and delivery fees are computed from server-controlled configuration, not customer-submitted amounts.
6. Confirm the production environment has a strong webhook secret and rotate any previous static/default value.
7. Review order-idempotency and customer-order retrieval: the existing path should be tested to ensure a phone number alone cannot expose an order's private details.
8. Deploy only after the release gate passes, with a backup and rollback plan.

## Deliverables

- `remix-choplife-republic-remediated-working-copy.zip` — complete source working copy with the targeted changes and static regression script.
- This report — findings, scope, verification limits, and release gates.
