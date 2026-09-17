# REQUIREMENTS — SCNT Vault feature expansion (F1–F5)

Approved by user 2026-09-18 ("do all" / "go ahead"). Replaces the completed dark-redesign contract.

## Final success criteria (all must be met, in order)

### Phase F1 — Foundation & feedback plumbing
- F1.1: Business settings moved to a Firestore `settings` collection with local defaults; used by: default prices (CostPrice 145, SellingPrice 220, ResellerPrice 195, Price60ml 175, Cost60ml 125), LowStockThreshold (10), tester-kit pcs + price, payment methods list, loyalty tier thresholds (VIP 200 / Gold 100 / Silver 50). No hardcoded business value remains in page code (file:line verified per grep).
- F1.2: Error toasts replace silent `console.error`/`catch{}` on: Inventory save/delete, Layout logout, POS order-mark-fail, DataContext subscription errors, stock-adjust quota fallback. Every user action ends with visible success or error feedback.
- F1.3: Duplicate-write guard: POS checkout submit and all modal save buttons are disabled while the operation is in flight (no double-click duplicate writes).

### Phase F2 — Complete the dead UI
- F2.1: Dead tabs wired or removed: Sales.jsx "Overview/Transactions/Reports", Inventory.jsx "Overview/Products/Categories/Brands", Suppliers/Customers/Resellers/Testers "Overview" tabs. No dead/no-op tab remains.
- F2.2: Resellers gets sort pills matching other pages.
- F2.3: Login gets a Forgot Password link + flow using AuthContext.resetPassword.

### Phase F3 — Revenue logic
- F3.1: Loyalty points auto-earn on POS checkout (rate configurable via settings; customers' LoyaltyPoints increase; tiers reflect live).
- F3.2: Reseller DiscountRate auto-applies at POS when a reseller is selected (price = ResellerPrice × (1 − DiscountRate)).
- F3.3: Testers link to product SKUs; option to auto-create a tester from a product.
- F3.4: Low-stock reorder suggestions: suggested PO from products under threshold + sales velocity, using existing PO generation machinery.

### Phase F4 — Export/import/print/reporting
- F4.1: 80mm receipt printing from POS alongside existing PDF invoice.
- F4.2: Stock movement / dead-stock / slow-mover report in Reports.
- F4.3: CSV import for bulk products + stock adjustment.

### Phase F5 — Roles, scale, speed
- F5.1: Roles owner/manager/employee on Firestore user docs; menu-level guards; seeded owner for the existing account; never lock out the owner.
- F5.2: Pagination (or virtualization) on Inventory, Sales, Customers, Suppliers, Resellers, Testers, PurchaseOrders lists.
- F5.3: Barcode scanning support on POS + Inventory (camera via dependency like html5-qrcode, or USB keyboard-wedge input) using BatchNumber.

## Delivery rules
- Phases run sequentially (shared writers: DataContext, POS, Layout). One PR per phase. QA gate after each phase: tests + build + runtime smoke.
- Deploy after merge, same flow as PR #13 (rebuild bundle → deployment/inventory → commit → firebase deploy).
- Existing tests (9 files / 61) must pass after every phase; new tests for new behavior.