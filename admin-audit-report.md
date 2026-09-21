# SCNT Vault Admin Panel — Comprehensive Audit Report

**Date:** September 21, 2026
**Scope:** `deployment/admin/` (vanilla JS) vs `inventory-app/src/pages/` (React)

---

## 1. Executive Summary

The admin panel is a **functional but outdated** vanilla JS application with significant security, feature, and code quality gaps compared to the modern React inventory app. The admin panel serves as a lightweight storefront order manager (website orders, contacts, analytics), while the inventory app is a full business operations suite (POS, sales, purchase orders, suppliers, resellers, testers, reports).

**Critical Finding:** Two separate codebases manage overlapping data (products, orders, customers) with different UI paradigms, feature sets, and security postures. This creates maintenance burden and user confusion.

### Score Card

| Area | Rating | Notes |
|------|--------|-------|
| Security | **D** | No CSP, no SRI, Firebase config exposed, XSS via innerHTML |
| Features | **C** | Covers basics, missing 60%+ of inventory app capabilities |
| Bugs | **B-** | Mostly functional, some dead code and race conditions |
| UI/UX | **B** | Clean dark theme, but inconsistent with inventory app |
| Code Quality | **C** | Single 1700-line HTML file, no modules, no tests |
| Maintainability | **D** | Not modernizable without rewrite |

---

## 2. Security Findings

### CRITICAL

| # | Finding | Location | Details |
|---|---------|----------|---------|
| S1 | **No Content Security Policy (CSP)** | `index.html` | No `<meta>` CSP tag or server header. Allows any script to execute, enabling XSS attacks. |
| S2 | **No SRI integrity hashes on CDN scripts** | `index.html:776-779` | `chart.js`, `firebase-app`, `firebase-auth`, `firebase-firestore` loaded from CDN without `integrity` attributes. A compromised CDN could inject malicious code. |
| S3 | **Firebase config exposed in HTML source** | `index.html:785-790` | API key, project ID, app ID visible to anyone. While Firebase client keys are designed to be public, this combined with weak Firestore rules creates risk. |
| S4 | **XSS via `innerHTML` and `onclick` string interpolation** | `admin-app.js` (entire file) | User-sourced data (`o.fullName`, `c.email`, `c.message`, `o.notes`) is interpolated into HTML strings via `innerHTML` and `onclick` handlers without sanitization. A crafted contact message or customer name can execute arbitrary JS. |
| S5 | **`document.write()` used in receipt printing** | `index.html` (POS receipt) | Opens new window and writes raw HTML. Not an XSS vector from the admin itself but demonstrates unsafe patterns. |

### HIGH

| # | Finding | Location | Details |
|---|---------|----------|---------|
| S6 | **No admin role verification** | `index.html:873-899` | Any Firebase-authenticated user can access the admin panel. No `admin` claim check or server-side role validation. Any registered user becomes an admin. |
| S7 | **Credentials logged to console** | `admin-app.js:47` | `auth.signOut().catch(function(e) { console.error(e); })` — while not logging credentials, the pattern shows no error boundary. Auth state errors may leak to console. |
| S8 | **`test-auth.html` left in production** | `test-auth.html` | Debug/test file with inline Firebase config and login functionality is publicly accessible. Should be removed from deployment. |

### MEDIUM

| # | Finding | Location | Details |
|---|---------|----------|---------|
| S9 | **Inline Firebase initialization script** | `index.html:782-797` | Should be in `api/firebase-admin.js` which already exists and is unused (dead code). The inline script duplicates the external file. |
| S10 | **No input validation on product forms** | `admin-app.js:336-359` | Product save accepts any string for Name, Brand, Category. No max length, no character validation, no server-side validation. |
| S11 | **Delete operations use native `confirm()`** | `admin-app.js:363-368` | Inconsistent UX — some deletes use `showConfirm()`, others use `confirm()`. The `confirm()` dialog is also not styled. |

### LOW

| # | Finding | Location | Details |
|---|---------|----------|---------|
| S12 | **Firebase compat SDK used** | `index.html:777-779` | Using the compat API (`firebase.auth()`) instead of the modular API. Not a security issue per se, but the compat SDK is deprecated and receives less security attention. |
| S13 | **No rate limiting on Firestore reads** | `admin-app.js` | Dashboard loads all products, orders, and contacts in a single `Promise.all`. With large datasets, this could exhaust Firestore quota. |

---

## 3. Feature Comparison: Admin vs Inventory

### Features in Inventory but MISSING from Admin

| Feature | Inventory Page | Admin Status |
|---------|---------------|--------------|
| **POS (Point of Sale)** | `POS.jsx` — Full cart, checkout, invoice PDF, receipt printing, barcode scanning, reseller pricing | Not present |
| **Sales management** | `Sales.jsx` — CRUD, delete with stock restore, CSV export, date range tabs, type breakdown | Not present (only website orders) |
| **Resellers** | `Resellers.jsx` — Full CRUD, discount rates, active/inactive, sales history, performance stats | Not present |
| **Suppliers** | `Suppliers.jsx` — CRUD, linked products, PO tracking, spend stats, clipboard copy | Not present |
| **Purchase Orders** | `PurchaseOrders.jsx` — Full CRUD, auto-generate from sales, reorder suggestions, stock add/release, bottle serials | Not present |
| **Testers** | `Testers.jsx` — CRUD, status tracking (Available/In Use/Empty/Damaged), scent family color system | Not present |
| **Reports** | `Reports.jsx` — Sales, products, customers, resellers, stock movements, dead stock, slow movers, CSV export per tab | Not present (basic analytics only) |
| **Loyalty points system** | `Customers.jsx` + `POS.jsx` — Auto-earn on sale, tier calculation (VIP/Gold/Silver/Member) | Not present |
| **Barcode scanning** | `Inventory.jsx`, `POS.jsx` — Camera-based barcode scanner component | Not present |
| **CSV import** | `Inventory.jsx` — Bulk product import, stock adjustments import via CSV | Not present |
| **Grid + Table view toggle** | All pages | Not present (table only) |
| **Pagination** | All pages | Not present (loads all) |
| **Loading skeletons** | All pages | Present (basic) |
| **Empty state CTAs** | All pages | Present (basic) |
| **Multi-price support** | `Inventory.jsx` — CostPrice, SellingPrice, ResellerPrice, Price60ml, Cost60ml | Not present (single price) |
| **Settings context** | `SettingsContext.jsx` — Loyalty tiers, payment methods, tester kit config, default prices | Not present (only threshold) |
| **Keyboard shortcuts** | All pages — `/` for search, `F2` for checkout, arrow keys | Admin has `/` only |
| **Responsive mobile layout** | Full mobile support | Basic (hamburger menu) |

### Features in Admin but NOT in Inventory

| Feature | Admin | Inventory Status |
|---------|-------|-----------------|
| **Website order management** | Orders from web store (scnt-vault.web.app) | Not present (POS sales only) |
| **Contact form messages** | Contact message viewer with read/replied status | Not present |
| **Website customer aggregation** | Derived from web orders | Customer collection is separate |
| **Order status timeline** | Visual timeline in order detail modal | Not present |

### Features that are Broken/Incomplete in Admin

| Issue | Details |
|-------|---------|
| **`api/firebase-admin.js` is dead code** | Never loaded by `index.html`. The inline script duplicates its functionality. |
| **`assets/admin-app.js` is dead code** | Never loaded by `index.html`. All logic is inline. Two copies of the app exist — the external file is an older version. |
| **`assets/admin-styles.css` is dead CSS** | Never loaded. All styles are inline in `<style>` tags. |
| **Settings page is minimal** | Only low stock threshold + CSV export. No store name, no payment methods, no business hours, no tax settings. |
| **Analytics page has no date range filter** | Hardcoded to "all time" — no way to filter by period. |
| **Product form missing fields** | No CostPrice, no ResellerPrice, no BatchNumber, no ExpirationDate, no Supplier link, no SKU. |

---

## 4. Bugs Found

### Critical Bugs

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| B1 | **`dateRange` variable declared but never used** | `index.html:810` | Dead variable, no impact but indicates incomplete feature |
| B2 | **Dashboard `chart.js` instances leak memory** | `index.html:1059,1071` | Charts are created with `new Chart()` but never destroyed on page transition. Repeated navigation creates orphaned chart instances. |
| B3 | **`showStatusPicker` inline HTML injection** | `index.html:848-870` | The `current` status is interpolated directly into HTML without escaping. If a status value contained HTML, it would execute. |

### High Bugs

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| B4 | **Race condition on page transition** | `index.html:937-952` | `loadPage` sets innerHTML after a 200ms timeout. If user clicks rapidly, multiple `loadPage` calls can interleave, causing stale content or event listener duplication. |
| B5 | **`onclick` handler leaks with `innerHTML` replacement** | `index.html:1003` | `onclick="document.querySelector('[data-page=orders]').click()"` is set via innerHTML. If the DOM is replaced, the handler reference breaks. |
| B6 | **Product delete uses escaped quotes but doesn't handle all cases** | `admin-app.js:303` | `replace(/'/g,"\\'")` doesn't handle backslashes, double quotes, or newlines in product names. A product named `O'Brien's "Test"` would break the onclick handler. |
| B7 | **No error handling on Firestore batch operations** | `admin-app.js:766-780` | The "Apply Threshold" button batches updates but has no size limit. Firestore batches support max 500 operations. With >500 products, this silently fails. |

### Medium Bugs

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| B8 | **Contact message preview truncation is hardcoded** | `index.html:1393` | `c.message.substring(0, 50)` — no HTML entity decoding, so `&amp;` shows as `&amp;` in the preview. |
| B9 | **Customer sort has no default for "name" sort** | `admin-app.js` | The `sortCust` select doesn't include a sort option, so the default sort is `orders` only. |
| B10 | **`_viewCustomer` uses `window._allCustomers`** | `index.html:1497-1506` | Stores customer list on `window` global. This is fragile — if `loadCustomers` hasn't run yet, `_allCustomers` is undefined. |
| B11 | **Chart color inconsistency** | `admin-app.js` | Dashboard uses indigo/purple (`#6366f1`, `#8b5cf6`) while the inline version uses warm brown (`#8b7355`, `#c4a882`). Two different color schemes exist. |
| B12 | **Settings "Apply to All" has no confirmation** | `admin-app.js:766` | Applies threshold to all products without user confirmation. Could be destructive if threshold is set incorrectly. |

### Low Bugs

| # | Bug | Location | Impact |
|---|-----|----------|--------|
| B13 | **`fmtDT` uses `toLocaleString` which varies by browser** | `index.html:961-965` | Date formatting may differ across browsers/devices. |
| B14 | **Escape key handler doesn't check for confirm dialogs** | `index.html:1686-1691` | Pressing Escape closes modals but also closes any open `confirm-overlay`, which may not be the user's intent. |
| B15 | **No `autocomplete="off"` on password field** | `index.html:717` | Has `autocomplete="new-password"` but should be `autocomplete="current-password"` for login. |

---

## 5. UI/UX Issues

### Visual Consistency

| Issue | Admin | Inventory | Impact |
|-------|-------|-----------|--------|
| **Theme** | Light (#f8f6f1 warm bg, dark sidebar) | Dark (#0f172a bg, teal accent) | Completely different visual language |
| **Font** | Inter + Playfair Display | System + Inter | Different typography hierarchy |
| **Accent color** | Brown/gold (#8b7355) | Teal (#2dd4bf) | Brand inconsistency |
| **Button style** | Rounded rectangles, flat | Gradient, hover-lift, glass effects | Different interaction patterns |
| **Card style** | White cards, light borders | Dark cards, subtle borders, shadows | Opposite contrast approach |
| **Sidebar** | Dark fixed sidebar with nav links | Teal gradient top bar with tabs | Different navigation paradigms |

### Missing UI Components

| Component | Inventory Has | Admin Status |
|-----------|--------------|--------------|
| Grid view toggle | ✅ Grid + Table | ❌ Table only |
| Pagination | ✅ Component-based | ❌ None (loads all) |
| Toast notifications | ✅ Context-based | ✅ Basic toast |
| Confirm dialog | ✅ Shared component | ⚠️ Mixed (confirm + showConfirm) |
| Loading spinner | ✅ Full-page spinner | ⚠️ Skeleton rows only |
| Empty state CTA | ✅ With icon + button | ⚠️ Text only |
| Search bar | ✅ With icon, focus ring | ✅ Basic input |
| Status badges | ✅ Consistent component | ✅ CSS-based |
| Modal | ✅ Shared Modal component | ⚠️ Raw HTML modals |
| Stat cards | ✅ Animated with icons | ⚠️ Basic stat-value div |

### Responsive Design

| Issue | Details |
|-------|---------|
| **Mobile sidebar** | Admin has hamburger toggle, works well |
| **Tables** | Admin tables have `overflow-x: auto` — good |
| **Forms** | Admin forms collapse to single column — good |
| **Charts** | Charts don't resize well on mobile |
| **Modals** | Modals use fixed positioning, may not work well on small screens |

### Accessibility

| Issue | Details |
|-------|---------|
| **No ARIA labels** | Buttons use Unicode symbols (☰, ✉, ★) without aria-label |
| **No focus management** | Modal open doesn't trap focus |
| **No keyboard navigation** | Can't tab through table rows or modal actions |
| **Color contrast** | Light gray text (#999) on white bg may fail WCAG AA |
| **No skip links** | No way to skip navigation |

---

## 6. Missing Features (Prioritized)

### P0 — Must Have

1. **XSS protection** — Sanitize all user data before innerHTML insertion
2. **CSP headers** — Add Content-Security-Policy meta tag
3. **SRI hashes** — Add integrity attributes to all CDN scripts
4. **Remove test-auth.html** — Remove debug file from production
5. **Admin role verification** — Check Firebase custom claims or Firestore role document

### P1 — Should Have

6. **User management** — Add/edit/delete admin users, assign roles
7. **Audit log** — Track who changed what and when
8. **Pagination** — Load products/orders in pages, not all at once
9. **Bulk operations** — Select multiple products for delete/visibility toggle
10. **CSV export for all data** — Products done, add orders, contacts, customers
11. **Date range filter on Analytics** — Currently hardcoded to all time
12. **CostPrice/Supplier fields on products** — Currently missing from admin product form
13. **Settings page** — Store name, payment methods, tax rate, business hours

### P2 — Nice to Have

14. **Real-time updates** — Use `onSnapshot` instead of one-time `get()`
15. **Notification system** — Push notifications for new orders/messages
16. **Print packing slips** — From order detail modal
17. **Dark mode toggle** — Match inventory app theme option
18. **Responsive charts** — Better mobile chart rendering

---

## 7. Code Quality Assessment

### Structure Issues

| Issue | Severity | Details |
|-------|----------|---------|
| **Single 1700-line HTML file** | High | All CSS (680 lines), all HTML (200 lines), and all JS (820 lines) in one file. Impossible to maintain at scale. |
| **Three dead files** | Medium | `admin-app.js`, `admin-styles.css`, `firebase-admin.js` exist but are never loaded. The HTML contains inline duplicates. |
| **No module system** | High | Everything is in a single IIFE. No imports, no exports, no code splitting. |
| **Global state via `window`** | High | Functions like `_viewOrder`, `_editProduct`, `_delProduct` are attached to `window` for onclick handlers. This pollutes the global namespace. |
| **No tests** | High | Zero test files. No unit, integration, or E2E tests. |

### Code Smells

| Smell | Location | Fix |
|-------|----------|-----|
| Duplicated code blocks | Dashboard stats HTML built as string concatenation | Extract to template functions |
| Magic numbers | `86400000` for day, `50` for message preview | Use named constants |
| Deeply nested ternaries | `orderStatusBadge` function | Use lookup table |
| Mixed async patterns | `.then().catch()` mixed with `async/await` | Standardize on `async/await` |
| Inline styles | All modals and cards use inline `style=` objects | Extract to CSS classes |

### Modernization Recommendations

| Recommendation | Effort | Impact |
|----------------|--------|--------|
| **Rewrite as React** | High | Align with inventory app, share components, shared context/providers |
| **Use Firebase modular SDK** | Medium | Better tree-shaking, no compat layer |
| **Extract to components** | Medium | Split into `Dashboard.jsx`, `Products.jsx`, etc. |
| **Add TypeScript** | Medium | Type safety for Firestore documents |
| **Add ESLint + Prettier** | Low | Consistent code style |
| **Set up Vite** | Low | Fast builds, HMR, proper module system |

---

## 8. Recommended Action Plan

### Phase 1: Security Hardening (1-2 days)

- [ ] Remove `test-auth.html` from deployment
- [ ] Add CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com; ...">`
- [ ] Add SRI hashes to all CDN `<script>` tags
- [ ] Sanitize all innerHTML inserts — create an `escapeHtml()` function and apply to all user data
- [ ] Add admin role check on auth state change (check Firestore `admins` collection or custom claims)
- [ ] Remove the unused `api/firebase-admin.js`, `assets/admin-app.js`, `assets/admin-styles.css` files (or consolidate)

### Phase 2: Bug Fixes (2-3 days)

- [ ] Fix Chart.js memory leak — destroy charts before re-rendering
- [ ] Fix product name escaping in onclick handlers
- [ ] Add Firestore batch size limit (chunk to 500)
- [ ] Fix `_viewCustomer` to not use `window` global
- [ ] Add confirmation dialog to "Apply Threshold" button
- [ ] Fix contact message preview HTML entity display

### Phase 3: Feature Parity (1-2 weeks)

- [ ] Add CostPrice, ResellerPrice, BatchNumber, SupplierId to product form
- [ ] Add date range filter to Analytics page
- [ ] Add pagination to all data tables
- [ ] Add CSV export for orders and contacts
- [ ] Add Settings page with business config
- [ ] Add user management (admin CRUD)

### Phase 4: Modernization (2-4 weeks)

- [ ] Initialize React project with Vite
- [ ] Migrate admin panel to React, sharing components with inventory app
- [ ] Implement real-time Firestore listeners
- [ ] Add TypeScript
- [ ] Add ESLint + Prettier
- [ ] Write integration tests

---

*Report generated by comprehensive file audit of `deployment/admin/` (6 files, ~2800 LOC) and `inventory-app/src/pages/` (11 files, ~9500 LOC).*
