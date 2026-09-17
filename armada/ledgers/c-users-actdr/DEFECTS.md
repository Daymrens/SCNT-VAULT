# DEFECTS — c-users-actdr (SCNT Vault dark redesign lane)

## Audit summary
- **Date:** 2026-09-18
- **Branch:** feat/web-ui-redesign (PR #12)
- **Auditors:** Corvette (runtime/features/functions), Bark standing in for Xebec (adversarial)
- **Tests:** 47 passed (7 files) · **Build:** passes (1.3 MB main bundle, chunk warning pre-existing)
- **Runtime:** all 11 routes load, zero page errors; only console error is expected Firestore permissions noise while unauthenticated (DataContext.jsx:79, caught)

## Verdict
PASS overall, BUT one confirmed crash bug (BLOCKING) + several integrity fixes recommended before merge/deploy.

---

## BLOCKING

### DEF-001: Toast API misuse breaks every write flow in Sales / PurchaseOrders / Testers
- **Files:** `inventory-app/src/pages/Sales.jsx:56,154,157` · `PurchaseOrders.jsx:56,216-323` · `Testers.jsx:68,113-132`
- **Confirmed by direct read:** `Toast.jsx:25` exposes only `{ showToast }`, but these 3 pages do `const toast = useToast()` and call `toast.success/error/info` (19 call sites). `toast.success` is `undefined` → TypeError AFTER the awaited write resolves.
- **Failure mode:** Sale delete: stock restored + sale deleted, then TypeError (feedback never shows). PO `handleSave` (216/219): TypeError fires before `closeModal()` → modal stays open, stale state, retry → **duplicate purchase order**. Error paths call `toast.error` inside `catch` → unhandled rejection, failure double-invisible.
- **Fix:** call sites → `showToast(msg, type)`; or export convenience methods from the provider. Verify Customers/Suppliers/Resellers/POS (already use `{ showToast }`, OK).

## FIX_NOW

### DEF-002: CSV export does not escape commas/quotes/newlines (data corruption + injection)
- **Files:** `Sales.jsx:169`, `Reports.jsx:122` — `rows.map(r => r.join(',')).join('\n')`
- **Fix:** RFC 4180 quoting (wrap fields containing `,` `"` `\n` in quotes, double internal quotes); prefix `'` for cells starting with `= + - @` (formula injection).

### DEF-003: Sale delete restores stock BEFORE deleting (double-restock on retry)
- **File:** `Sales.jsx:151` then `:153`
- **Fix:** delete first, restore stock only on success (or transaction).

### DEF-004: Queued offline sales lose Firestore Timestamp → blank/invalid dates
- **File:** `inventory-app/src/utils/offlineQueue.js:25-31` JSON.stringify serializes Timestamp to `{seconds,nanoseconds}`; flush rehydrates plain object; `invoice.js` `typeof v.toDate === 'function'` guard fails → blank dates on replayed invoices + Sales/Reports rows.
- **Fix:** custom serializer for Timestamp (`{__ts:true, seconds, nanoseconds}`) or store ISO strings for date fields.

### DEF-005: PO add/release stock is non-idempotent — mutation before completion marker
- **Files:** `PurchaseOrders.jsx:232-238` (`handleAddStock`), `:251-257` (`handleReleaseStock`) — stock bumped first, marker write second; retry after marker failure double-counts. Release clamps at 0 silently (`Math.max(0,...)` :255) masking over-releases.

## AT-RISK (design-level; DEFERRED unless user approves scope extension)

### DEF-006: Stock read-modify-write race — lost updates + field clobber
- **Files:** `POS.jsx:209` (`{...product, Stock: product.Stock - qty}`), `PurchaseOrders.jsx:236,255`, `Sales.jsx:151` — render-time snapshot; two cashiers same SKU → lost decrement; `{...product}` also spreads `id` and stale fields.
- **Fix (not trivial):** `FieldValue.increment` or `runTransaction`. Conflicts with offline/local-first quota fallback.

### DEF-007: Offline sale queued but stock decrement silently swallowed → permanent inventory inflation
- **Files:** `DataContext.jsx:227-231` (quota fallback queues sale), `DataContext.jsx:153-156` (updateProduct quota-swallows), `POS.jsx:204-210` decrements stock separately.
- **Fix (design):** queue stock deltas with the sale, or reject offline checkout.

### DEF-008: Flush deletes pending sales on ANY non-quota error → silent sale loss
- **File:** `DataContext.jsx:98-103` — `removePendingWrite(w.ts)` unconditional on non-quota error (network blip/rate limit during flush → sale record gone forever).
- **Fix (design):** remove only on success or after N retries; max-retry + UI banner "X sales pending sync".

## LOW / cosmetic

- DEF-009: `Reports.jsx:26-33` `filteredSales` memo missing `cutoff` dep → stale across renders. FIX_NOW trivial.
- DEF-010: `POS.jsx:189` `Timestamp.fromDate(new Date(saleDate))` throws for cleared date input → generic failure. Add date validity guard.
- DEF-011: Subscription errors blank whole collections (`DataContext.jsx:58,80,118,129`) with only console.error — no user feedback.
- DEF-012: Clipboard calls lack `.catch` (`Customers.jsx:159`, `Suppliers.jsx:137`) → unhandled rejection off HTTPS.
- DEF-013: Auth-gated subscriptions fire for unauthenticated users (`DataContext.jsx:40-88`) — expected catch, no functional impact.
- DEF-014: Build 1.3 MB main bundle (recharts + firebase eager) — perf, DEFERRED.
- Earlier findings (FIND-001..003 in armada/ledgers/web-ui-redesign/DEFECTS.md): contrast #64748b→#7b8da3 FIX_NOW; hardcoded hex DRY + Modal #fff DEFERRED.

## Dispositions (delivery lead)
- DEF-001: **BLOCKING** — fix before merge.
- DEF-002, DEF-003, DEF-004, DEF-005, DEF-009, DEF-010: **FIX_NOW**.
- DEF-006, DEF-007, DEF-008: **DEFERRED** — pre-existing architecture (not introduced by redesign); need explicit user approval to change Firestore write semantics (visual-only contract).
- DEF-011, DEF-012: **DEFERRED** — pre-existing, low impact.
- DEF-013: **ACCEPTED_RISK** — caught, app works.
- DEF-014: **DEFERRED** — perf.

## Remediation status (2026-09-18)
- All BLOCKING + FIX_NOW fixed in commit `e870873` (pushed, PR #12 updated): toast API (DEF-001), CSV escaping (DEF-002), sale delete order (DEF-003), timestamp serialization (DEF-004), PO idempotency (DEF-005), memo dep (DEF-009), POS date guard (DEF-010).
- QA retest (Corvette): **PASS** — 8 test files / 56 tests, build ok, zero remaining findings.
- DEF-006 (stock write race), DEF-007 (offline stock swallow), DEF-008 (flush drops sales): still DEFERRED — awaiting user decision (architectural Firestore write-semantics changes, out of visual-only contract scope).