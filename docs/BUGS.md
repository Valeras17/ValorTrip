# Bug Tracking & Known Issues

This document tracks identified bugs, root-cause analyses, and resolution statuses across the **ValorTrip** project.

---

## 📌 Bug Status Summary

| ID | Title | Component | Severity | Status |
|---|---|---|---|:---:|
| **BUG-001** | `Member.isActive` evaluates to false due to Unix Epoch 0 | Database / Models | 🔴 High | **FIXED** |
| **BUG-002** | Race condition in QR join before DB write completes | Navigation / Sync | 🔴 High | **FIXED** |
| **BUG-003** | Sum validation mismatch on Step 1 of Add Expense | UI / Validation | 🟡 Medium | **FIXED** |
| **BUG-004** | Confirmation status not re-rendering on Trip screen | UI / Reactivity | 🟡 Medium | **FIXED** |
| **BUG-005** | High-density QR scan failure in poor lighting | Camera / QR Sync | 🟢 Low | **OPEN (Mitigated)** |
| **BUG-006** | OCR text misdetection on crumpled or angled receipts | OCR Engine | 🟢 Low | **OPEN** |

---

## 🛠️ Detailed Bug Reports

### BUG-001: `Member.isActive` returns false due to Unix Epoch 0 (`new Date(0)`)
- **Component**: [`src/db/models/index.ts`](file:///F:/androids/react_native/valortrip/src/db/models/index.ts#L39-L42), [`src/features/groups/groupActions.ts`](file:///F:/androids/react_native/valortrip/src/features/groups/groupActions.ts#L33)
- **Severity**: 🔴 High
- **Status**: **FIXED** (Commit `c1d9364`)
- **Symptoms**:
  - In `add-expense.tsx`, newly added members did not appear in the member list unless the user toggled the "Show inactive members" switch.
- **Root Cause**:
  - In `groupActions.ts`, active members were initialized with `raw(m).left_at = 0`.
  - WatermelonDB's `@date('left_at')` decorator transforms numeric timestamp `0` into `new Date(0)` (representing `1970-01-01T00:00:00.000Z`).
  - In JavaScript, `new Date(0) !== null` evaluates to `true`.
  - The model getter was written as:
    ```typescript
    get isActive(): boolean {
      return this.leftAt === null; // Returned false for new members!
    }
    ```
- **Fix**:
  - Updated the getter to recognize timestamp 0 as active:
    ```typescript
    get isActive(): boolean {
      return this.leftAt === null || this.leftAt.getTime() === 0;
    }
    ```

---

### BUG-002: Race Condition in QR Join (`join-group.tsx`)
- **Component**: `src/app/join-group.tsx`
- **Severity**: 🔴 High
- **Status**: **FIXED**
- **Symptoms**:
  - Scanning an invite QR code on an observer device showed "Joined!", but tapping "View Trip" crashed with `Diagnostic error: Record groups#... not found`.
- **Root Cause**:
  - Screen navigation (`router.push`) was triggered asynchronously before the `database.write(...)` promise fully committed records to SQLite.
- **Fix**:
  - Enforced `await database.write(...)` execution to guarantee atomic commit before triggering navigation. Added verification check and fallback alert.

---

### BUG-003: Payers Sum Mismatch Blocking Step Progression
- **Component**: `src/app/add-expense.tsx`
- **Severity**: 🟡 Medium
- **Status**: **FIXED**
- **Symptoms**:
  - Inconsistent state where payers sum did not equal total amount, but user could navigate to Step 2, creating orphaned unbalanced shares.
- **Root Cause**:
  - Missing disabled state validation on the "Next: Who consumed?" button.
- **Fix**:
  - Implemented strict cent-exact invariant check: `isStep1Valid = Math.abs(payersSum - totalAmount) === 0`.
  - Button is disabled (opacity 50%) with warning indicator until payers sum matches the total expense amount.

---

### BUG-004: Confirmation Status ("Show to verify") UI Lag
- **Component**: `src/app/group/[id].tsx`, `src/features/expenses/expenseActions.ts`
- **Severity**: 🟡 Medium
- **Status**: **FIXED**
- **Symptoms**:
  - After a companion tapped "Confirm I've seen this", the trip screen did not immediately show the `✅ [Name]` badge without manually restarting or navigating back.
- **Root Cause**:
  - Component did not observe `expense.confirmations` query with an active subscription.
- **Fix**:
  - Wrapped confirmation list rendering in reactive subscription to `confirmations.observe()`.

---

### BUG-005: High-Density QR Optical Scan Failure in Poor Lighting
- **Component**: `src/app/share-snapshot.tsx`, `src/lib/snapshot.ts`
- **Severity**: 🟢 Low
- **Status**: **OPEN (Mitigated)**
- **Description**:
  - When trips exceed ~40 expenses, even compressed Base64 payloads approach ~1.8KB. At this density, budget mobile cameras with poor macro focus struggle to resolve QR dots in dark environments.
- **Mitigation**:
  - Added dynamic fallback: if snapshot exceeds optical safety limit (or if user prefers), a "Share Snapshot as File" button exports the `.json` bundle directly via native OS Share Sheet (`expo-sharing`).

---

### BUG-006: OCR Misdetection on Crumpled Receipts
- **Component**: `src/app/add-expense.tsx`
- **Severity**: 🟢 Low
- **Status**: **OPEN**
- **Description**:
  - When photographing receipts at sharp angles or with strong creases, text lines can be split across multiple bounding boxes, leading to sub-optimal total candidate detection.
- **Planned Resolution**:
  - Add document border detection and perspective unwarping prior to running OCR.
