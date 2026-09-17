# DEFECTS — web-ui-redesign

## Audit Summary
- **Date:** 2026-09-17
- **Branch:** feat/web-ui-redesign
- **QA Agent:** Corvette + Bark (architecture)
- **Verdict:** PASS with findings (both lanes)

## Dispositions (delivery lead, 2026-09-17)
- FIND-001 (text-muted contrast): **FIX_NOW** — change-introduced token, cheap single-line fix before deploy; WCAG AA
- FIND-002 (hardcoded hex DRY): **DEFERRED** — values already theme-consistent, cosmetic maintainability only
- FIND-003 (Modal #fff close icon): **DEFERRED** — acceptable foreground on dark overlay, cosmetic
- Bark hygiene notes (POS trailing newline, commit order anomaly, baseline-less pages): **DEFERRED** — zero behavioral impact, verified via lazy-load-reads byte-identity + sanity scan

---

### FIND-001: WCAG AA Contrast Failure — text-muted on bg-card
- **Severity:** MEDIUM
- **Status:** OPEN
- **Component:** `inventory-app/src/index.css` (design tokens)
- **Description:** `#64748b` (text-muted) on `#1f232b` (bg-card) yields contrast ratio 2.61:1, below WCAG AA 4.5:1 for normal text. Used for uppercase metadata labels (11-12px), input placeholders, and status badge sub-text.
- **Impact:** Small labels and placeholders are harder to read for low-vision users.
- **Recommendation:** Bump `--text-muted` to at least `#7b8da3` (ratio ~4.6:1 on bg-card) or `#8899ab` for safer margin.

### FIND-002: Hardcoded Hex Values in Customers/Resellers/PurchaseOrders
- **Severity:** LOW
- **Status:** OPEN
- **Components:** `Customers.jsx`, `Resellers.jsx`, `PurchaseOrders.jsx`
- **Description:** These three pages use inline hardcoded hex values (`#1f232b`, `#1a1d24`, `#161820`, `#e2e8f0`, `#64748b`, `#2dd4bf`, etc.) instead of `var(--bg-card)`, `var(--text-primary)`, etc. Values ARE consistent with the dark theme tokens but are not DRY.
- **Impact:** Future token changes require manual updates in multiple places. No runtime impact.
- **Recommendation:** Replace hardcoded hex with CSS custom properties for maintainability.

### FIND-003: Modal Close Button Uses #fff Instead of var(--text-primary)
- **Severity:** LOW
- **Status:** OPEN
- **Component:** `Modal.jsx:35`
- **Description:** The close button icon color is hardcoded `#fff` rather than `var(--text-primary)`. Acceptable on the dark overlay (0.7 opacity) but inconsistent with token usage elsewhere.
- **Impact:** Cosmetic only; no functional impact.
- **Recommendation:** Use `var(--text-primary)` for consistency.
