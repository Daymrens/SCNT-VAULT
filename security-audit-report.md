# Security Audit Report — SCNT Vault Web App

**Date:** September 18, 2026  
**Auditor:** Automated Security Scan  
**Scope:** Full application — React/Vite frontend + Firebase (Firestore, Auth, Hosting)  
**Stack:** React 18, Vite, Firebase Auth, Firestore, Firebase Hosting  

---

## Executive Summary

The SCNT Vault application has **3 Critical**, **4 High**, **3 Medium**, and **3 Low** severity findings. The most urgent issue is that **Firestore security rules grant unrestricted read/write access to every collection**, making all data and operations accessible to any client — authenticated or not. This single flaw renders all client-side role enforcement, route protection, and permission checks ineffective.

---

## Finding F-001 — Firestore Rules Allow Unauthenticated Read/Write to All Collections

| Field | Detail |
|---|---|
| **Rule ID** | FIRESTORE-001 (OWASP SCNT-AUTHZ-001) |
| **Severity** | **CRITICAL** |
| **Location** | `D:\PROJECTS\Projects\SCNT WEB\firestore.rules:7-56` |
| **Evidence** | Every collection uses `allow read: if true; allow write: if true;` |
| **Impact** | Any client — including an unauthenticated attacker — can read, create, update, or delete **all** products, suppliers, customers, resellers, sales, purchase orders, testers, counters, analytics, newsletter, and test data. Financial records, customer PII, and business data are fully exposed. An attacker can manipulate inventory, forge sales, inject bad data, or wipe the database. |
| **Fix** | Replace open rules with auth + role checks. Minimum viable rules: |

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['owner', 'manager'];
    }
    function isAuthenticated() {
      return request.auth != null;
    }

    match /products/{productId} {
      allow read: if isAuthenticated();
      allow create, update: if isAdmin();
      allow delete: if isAdmin();
    }
    match /suppliers/{supplierId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /customers/{customerId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /resellers/{resellerId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /sales/{saleId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAdmin();
    }
    match /purchaseOrders/{orderId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /testers/{testerId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /counters/{counterId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    match /orders/{orderId} {
      allow read: if isAuthenticated();
      allow create: if true;  // public order form
      allow update, delete: if isAuthenticated();
    }
    match /contacts/{contactId} {
      allow read: if isAuthenticated();
      allow create: if true;
      allow update, delete: if isAdmin();
    }
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if request.auth.uid == userId;
      allow update: if isAdmin() || request.auth.uid == userId;
      allow delete: if isAdmin();
    }
    match /settings/{settingId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /analytics/{docId} {
      allow read: if isAdmin();
      allow create: if true;
      allow update, delete: if false;
    }
    match /newsletter/{docId} {
      allow read: if isAdmin();
      allow create: if true;
      allow update, delete: if false;
    }
    match /test/{docId} {
      allow read, write: if false;
    }
  }
}
```

---

## Finding F-002 — Users Collection Allows Self-Privilege Escalation

| Field | Detail |
|---|---|
| **Rule ID** | FIRESTORE-002 (OWASP SCNT-AUTHZ-002) |
| **Severity** | **CRITICAL** |
| **Location** | `D:\PROJECTS\Projects\SCNT WEB\firestore.rules:90-94` |
| **Evidence** | `match /users/{userId} { allow read: if request.auth != null; allow write: if request.auth != null; }` |
| **Impact** | Any authenticated user can write `{ role: 'owner' }` to their own `users/{uid}` document. If Firestore rules were tightened for other collections but this remained, the attacker could self-escalate to owner. Even with F-001 fixed, this hole permits complete privilege escalation. |
| **Fix** | Restrict `users/{userId}` writes: only allow the user to create their own doc, and only admins to change the `role` field. Alternatively, use a Cloud Function or Firestore trigger to assign roles. |

---

## Finding F-003 — XSS via `document.write` with Unsanitized User Data in Receipt

| Field | Detail |
|---|---|
| **Rule ID** | REACT-XSS-001 (OWASP A03:2021-Injection) |
| **Severity** | **CRITICAL** |
| **Location** | `src/pages/POS.jsx:327-377` |
| **Evidence** | `printWindow.document.write(receiptContent);` — the `receiptContent` string interpolates `successSale.CustomerName`, `successSale.InvoiceNumber`, and line item `ProductName` directly into HTML without escaping. |
| **Impact** | If an attacker controls a customer name (e.g., `<img src=x onerror=alert(document.cookie)>`), the injected HTML executes in the pop-up window. While the pop-up is a separate browsing context, it can perform actions scoped to the app's origin — potentially exfiltrating tokens or performing actions on behalf of the user. This is a stored XSS vector since the payload lives in Firestore customer/sale data. |
| **Fix** | Escape all interpolated values before insertion into the HTML string. Use a helper: |

```js
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Then in receiptContent:
const customerName = escapeHtml(successSale.CustomerName || 'Walk-in');
const invoiceNumber = escapeHtml(successSale.InvoiceNumber || successSale.id);
```

---

## Finding F-004 — No Content-Security-Policy (CSP) Header

| Field | Detail |
|---|---|
| **Rule ID** | HEADERS-001 (OWASP A05:2021-Security Misconfiguration) |
| **Severity** | **High** |
| **Location** | `index.html` (no CSP meta tag) and `D:\PROJECTS\Projects\SCNT WEB\firebase.json:32-68` (no CSP header configured) |
| **Evidence** | No `Content-Security-Policy` anywhere in HTML or hosting config. |
| **Impact** | Without CSP, the browser permits inline scripts, eval(), and loading scripts from any origin. This significantly increases the impact of any XSS vulnerability — injected scripts can exfiltrate data to external domains, load malware, or take over the session. |
| **Fix** | Add a CSP header in `firebase.json` or a `<meta>` tag in `index.html`: |

```json
{ "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://scnt-vault.web.app data: blob:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com" }
```

---

## Finding F-005 — All Role Enforcement is Client-Side Only

| Field | Detail |
|---|---|
| **Rule ID** | REACT-AUTHZ-001 (OWASP A01:2021-Broken Access Control) |
| **Severity** | **High** |
| **Location** | `src/contexts/RoleContext.jsx:8-42` (permission definitions), `src/components/Layout.jsx:58-62` (canAccessPage check) |
| **Evidence** | `canAccessPage()` checks `permissions.pages.includes(path)` — a purely frontend check. Firestore rules (F-001) allow unrestricted writes, so any user can call Firebase SDK directly to perform any operation regardless of their assigned role. |
| **Impact** | An employee can access the Reports page by modifying the client-side code or direct navigation. More critically, any user can directly invoke Firestore write operations (add, update, delete) on any collection using the Firebase SDK, bypassing all UI-level restrictions. Employee accounts can delete products, modify sales, and access owner-only functions. |
| **Fix** | Server-side (Firestore rules) must be the primary enforcement layer. See F-001 fix. Additionally, validate that role-based checks in `RoleContext` and `Layout` are defense-in-depth, not the sole gate. |

---

## Finding F-006 — No Input Sanitization on Forms

| Field | Detail |
|---|---|
| **Rule ID** | INPUT-001 (OWASP A03:2021-Injection) |
| **Severity** | **High** |
| **Location** | `src/pages/Inventory.jsx:258-267` (`handleSave`), `src/pages/POS.jsx:209-313` (`handleCheckout`), all CRUD operations in `DataContext.jsx` |
| **Evidence** | Form data is passed directly to Firestore with no sanitization: `await addProduct(form)` and `await addDoc(collection(db, 'products'), { ...product, ... })`. No trimming, no length limits, no character filtering. |
| **Impact** | Malicious product names, customer names, or other fields can contain script tags, control characters, or excessively long strings. Combined with F-003, this enables stored XSS. Even without XSS, it can corrupt data views, cause rendering issues, or enable data exfiltration if any field is ever rendered as HTML. |
| **Fix** | Add a sanitization utility and apply it before Firestore writes: |

```js
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, 500);
}
```

---

## Finding F-007 — Firebase API Key Exposed in Client Bundle

| Field | Detail |
|---|---|
| **Rule ID** | CONFIG-001 (OWASP A05:2021-Security Misconfiguration) |
| **Severity** | **High** |
| **Location** | `src/firebase/config.js:3` |
| **Evidence** | `apiKey: "AIzaSyCTVEb364hJZveBr0iUu5a39TpgcBb63no"` — hardcoded in source and bundled into client JS. |
| **Impact** | Firebase API keys are designed to be public and are used for Firebase SDK initialization. However, combined with the completely open Firestore rules (F-001), this key can be used by any attacker to directly access the Firestore database. If Firestore rules are properly locked down, the key alone is insufficient for unauthorized access. The key also reveals the project ID, which could be targeted for billing abuse (Firestore reads/writes at the attacker's leisure). |
| **Fix** | Firebase API keys are inherently client-side. The real fix is F-001 (proper Firestore rules). Additionally, configure **Firebase App Check** to prevent unauthorized API usage, and set up **Firestore usage budgets** in GCP Console. |

---

## Finding F-008 — Hardcoded Owner UID Exposed in Client Code

| Field | Detail |
|---|---|
| **Rule ID** | CONFIG-002 (OWASP A04:2021-Insecure Design) |
| **Severity** | **Medium** |
| **Location** | `src/contexts/RoleContext.jsx:6` |
| **Evidence** | `const OWNER_UID = '6aOu6pgtNuOWfxbKGMP4UMUCcb';` |
| **Impact** | The owner's Firebase Auth UID is visible in the client bundle. An attacker can use this to target the owner account for social engineering, phishing, or to craft Firestore requests specifically for that UID. Combined with F-002 (self-escalation), an attacker could impersonate the owner. |
| **Fix** | Store the owner UID in Firestore settings or a secure config, not in client code. Better yet, use a server-side Cloud Function for role assignment and ownership verification. |

---

## Finding F-009 — CSV Import Lacks Content Validation and Size Limits

| Field | Detail |
|---|---|
| **Rule ID** | INPUT-002 (OWASP A04:2021-Insecure Design) |
| **Severity** | **Medium** |
| **Location** | `src/pages/Inventory.jsx:275-334` (`handleFileSelect`), `src/contexts/DataContext.jsx:344-361` (`addBulkProducts`) |
| **Evidence** | CSV is parsed with `Papa.parse(file, { header: true })` with only basic field presence checks. No file size limit, no max row count, no field length validation, no type checking beyond `parseFloat`/`parseInt`. |
| **Impact** | An attacker could upload a multi-GB CSV file to cause browser memory exhaustion (DoS). Fields could contain extremely long strings or special characters. The `addBulkProducts` function iterates one-by-one with individual `addDoc` calls — no transaction batching, so partial imports leave inconsistent state. |
| **Fix** | Add file size limit (e.g., 5MB), max row count (e.g., 10,000), field length limits, and batch writes using Firestore `writeBatch()`. |

---

## Finding F-010 — No Strict-Transport-Security Header

| Field | Detail |
|---|---|
| **Rule ID** | HEADERS-002 (OWASP A05:2021-Security Misconfiguration) |
| **Severity** | **Medium** |
| **Location** | `D:\PROJECTS\Projects\SCNT WEB\firebase.json` |
| **Evidence** | No `Strict-Transport-Security` header configured. |
| **Impact** | Without HSTS, browsers may allow downgrade attacks to HTTP on first visit. While Firebase Hosting defaults to HTTPS, the absence of HSTS means a user typing `http://scnt-vault.web.app` may initially connect over HTTP before being redirected. |
| **Fix** | Add to `firebase.json` headers: |

```json
{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
```

---

## Finding F-011 — Offline Queue Data in localStorage Without Integrity Checks

| Field | Detail |
|---|---|
| **Rule ID** | STORAGE-001 (OWASP A08:2021-Software and Data Integrity Failures) |
| **Severity** | **Low** |
| **Location** | `src/utils/offlineQueue.js:59-77` |
| **Evidence** | `localStorage.setItem(PENDING_KEY, JSON.stringify(arr))` — pending sale data is stored in localStorage without any HMAC or integrity check. |
| **Impact** | An attacker with XSS or browser DevTools access can modify pending writes in localStorage to change sale amounts, stock deltas, or inject arbitrary sale records that will be synced to Firestore when online. The `readPendingWrites()` function deserializes and trusts the data without validation. |
| **Fix** | Add a simple HMAC signature to localStorage entries, or validate pending writes against expected data schemas before flushing. |

---

## Finding F-012 — Owner UID Hardcoded and Bypasses All Permission Checks

| Field | Detail |
|---|---|
| **Rule ID** | AUTHZ-003 (OWASP A04:2021-Insecure Design) |
| **Severity** | **Low** |
| **Location** | `src/contexts/RoleContext.jsx:62,88,92,101` |
| **Evidence** | `const isOwner = currentUser.uid === OWNER_UID;` — checked at multiple points to bypass all permission gates: role assignment, page access, and the `isOwner` export. |
| **Impact** | If the owner UID is ever changed or compromised, the hardcoded bypass requires a code redeploy. Additionally, the pattern creates a special-casing that's harder to audit. Every permission check has an implicit "unless owner" escape. |
| **Fix** | Move ownership designation to the Firestore `users` document role field (e.g., role: 'owner') rather than a hardcoded UID comparison. This centralizes the logic and allows role changes without code changes. |

---

## Finding F-013 — No Account Lockout or Rate Limiting on Client Side

| Field | Detail |
|---|---|
| **Rule ID** | AUTH-001 (OWASP A07:2021-Identification and Authentication Failures) |
| **Severity** | **Low** |
| **Location** | `src/pages/Login.jsx:226-238`, `src/contexts/AuthContext.jsx:21-23` |
| **Evidence** | `signIn(email, password)` calls `signInWithEmailAndPassword` with no client-side rate limiting. Firebase Auth has server-side protections, but the UI provides no feedback about lockout status. |
| **Impact** | An attacker can rapidly attempt passwords. Firebase Auth will eventually rate-limit, but the user experience is poor — the UI just shows "Failed to sign in" without indicating lockout. Combined with the exposed API key (F-007), automated credential stuffing is trivial. |
| **Fix** | Add client-side attempt tracking (e.g., exponential backoff after 5 failures). Display lockout messages. Consider Firebase App Check to prevent automated abuse. |

---

## Summary by Severity

| Severity | Count | Findings |
|---|---|---|
| **Critical** | 3 | F-001 (Firestore rules), F-002 (self-escalation), F-003 (XSS in receipt) |
| **High** | 4 | F-004 (no CSP), F-005 (client-side only authz), F-006 (no input sanitization), F-007 (API key exposure) |
| **Medium** | 3 | F-008 (hardcoded owner UID), F-009 (CSV import), F-010 (no HSTS) |
| **Low** | 3 | F-011 (localStorage integrity), F-012 (hardcoded owner bypass), F-013 (no rate limiting) |

---

## Recommended Priority

1. **Immediate** (do now): F-001, F-002, F-003 — These are actively exploitable and could lead to full data compromise.
2. **This sprint**: F-004, F-005, F-006, F-007 — Defense-in-depth measures that reduce blast radius.
3. **Next sprint**: F-008, F-009, F-010 — Hardening measures.
4. **Backlog**: F-011, F-012, F-013 — Nice-to-have improvements.

---

## Positive Observations

- Firebase Auth handles session management via IndexedDB (not localStorage) — good.
- No `eval()` or `new Function()` usage found in source code.
- No `postMessage` usage without origin validation found.
- `navigate()` calls use hardcoded paths with `encodeURIComponent()` — no open redirect vectors.
- `PrivateRoute` correctly blocks unauthenticated users at the routing level (defense-in-depth, though insufficient alone per F-001).
- Offline queue correctly uses `isQuotaError()` to detect quota issues before retrying.
- Barcode scanner callback (`onScan`) passes `decodedText` to product lookup functions, not to HTML — safe from injection.

---

*Report generated by automated security audit. Manual review recommended for all Critical and High findings before production deployment.*
