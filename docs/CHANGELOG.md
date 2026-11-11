# Changelog

All notable changes to the **ValorTrip** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-12 — MVP Release

### 🚀 Added
- **Offline-First SQLite Architecture**:
  - Full local persistence via **WatermelonDB** on SQLite with JSI (JavaScript Interface) integration.
  - Zero server dependency, zero user accounts, zero registration friction.
  - Reactive observable queries updating UI on database changes in real-time.
- **Single-Bookkeeper & Optical QR Sync**:
  - Bookkeeper device manages state; companion devices scan a single compressed QR code.
  - Sub-2KB snapshot payload with synchronous `fflate` Deflate (level 9) compression.
  - Deep-linkable snapshot hydration (`valortrip://snapshot/<base64>`) and QR invite flow (`valortrip://join/<id>`).
  - Automatic fallback to native file export (`.json` via `expo-sharing`) if trip snapshot exceeds QR density threshold.
- **On-Device Receipt Scanning (OCR)**:
  - Integration with camera and image picker for receipt text extraction.
  - Automatic detection of total amounts and itemized candidate numbers.
- **Minimum Cash Flow Settlement Algorithm**:
  - Greedy bipartite matching reducing circular pairwise debts ($O(N^2)$) to at most $N - 1$ physical transfers.
  - Mathematical money conservation guarantees ($\sum \text{Transfers} \equiv \sum \text{Credits} \equiv |\sum \text{Debts}|$).
  - One-tap "Record All as Settled" batch transaction logging.
- **2-Step Expense Creation & Validation**:
  - **Step 1 (Who paid)**: Multi-payer support with quick "Paid all" presets and strict sum validation ($\sum \text{Payers} \equiv \text{Total}$).
  - **Step 2 (Who consumed)**: Dual-mode splitting — Equal Split (integer cents distribution with remainder preservation) and Exact Amount allocation with auto-fill for the remaining balance.
- **Verification & Confirmation Mechanism ("Show to verify")**:
  - Offline peer verification dialog: companion inspects receipt on owner's phone and taps "Confirm I've seen this".
  - Verified badges (`✅ Ivan`) reflected dynamically in expense cards.
- **Lifecycle & Integrity Validation**:
  - Pre-close audit checking for unsettled balances or departed members before archiving trips.

### 🐛 Fixed
- **`Member.isActive` Timestamp Bug**: Fixed issue where `left_at: 0` was converted by `@date` decorator to `new Date(0)` (Jan 1, 1970), causing all newly created members to be falsely treated as inactive (`leftAt !== null`).
- **QR Join Race Condition**: Resolved race condition in `join-group.tsx` where screen navigation occurred before WatermelonDB write transactions fully completed.
- **Expense Balance & Math Invariants**: Enforced strict validation preventing user progression if payers or consumers sums mismatch the total.

---

