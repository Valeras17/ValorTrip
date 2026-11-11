# Feature Inventory & Product Roadmap

This document outlines the features implemented in **ValorTrip v1.0.0 (MVP)** and tracks the product roadmap for future milestones.

---

## ✅ Implemented Features (v1.0.0 MVP)

### 1. Offline-First Foundation
- **Local SQLite Persistence**: Built with **WatermelonDB** running over native C++ JSI for sub-millisecond query performance.
- **Zero Registration & Accounts**: No email, passwords, phone numbers, or external authentication providers.
- **Device-Anchored Ownership**: Unique cryptographic device identifier stored in hardware-backed secure storage (`expo-secure-store`).

### 2. Group & Member Lifecycle Management
- **Single-Bookkeeper Concept**: The group creator (Owner) holds the master ledger; members are invited as companions.
- **Dynamic Member States**: Supports members who join late or depart early (`left_at`, `returned_at`), preventing unfair expense allocations.
- **Pre-Close Trip Audit**: Ensures departed members have a zero balance and all settlements are recorded before archiving.

### 3. Optical Sync Engine (Air-Gapped QR Snapshot)
- **Sub-2KB QR Code Encoding**: State serialization compressed via `fflate` DEFLATE (level 9) into Base64.
- **Deep Linking Protocol**: Handles `valortrip://join/<id>` (invites) and `valortrip://snapshot/<base64>` (full sync).
- **Fast-Forward SQLite Hydration**: Companion devices scan the QR code to replicate the master database in a single atomic transaction.
- **Native File Share Fallback**: Automatic export to `.json` via OS Share Sheet (`expo-sharing`) when data exceeds the QR density threshold.

### 4. Advanced Expense & Multi-Payer Splitting
- **Integer Cents Representation**: All internal math uses integer cents to eliminate JavaScript floating-point rounding errors.
- **Two-Step Split Flow**:
  - **Step 1 (Who paid?)**: Supports multiple payers with automatic sum validation and convenient "Paid all" shortcuts.
  - **Step 2 (Who consumed?)**:
    - *Split Equally*: Automatically divides integer cents and assigns remainder pennies to the last consumer.
    - *By Amount*: Custom share entry with real-time remaining balance computation and auto-fill.
- **Receipt Image Attachment & OCR**:
  - Camera capture and gallery picker.
  - Text extraction and automated candidate total detection.

### 5. Minimum Cash Flow Debt Reduction
- **Greedy Bipartite Settlement Engine**: Reduces $O(N^2)$ circular debts into at most $N - 1$ direct transfers.
- **Conservation of Money Guarantee**: $\sum \text{Credits} \equiv \sum \text{Debts} \equiv \sum \text{Transfers}$.
- **One-Tap "Record All as Settled"**: Generates formal settlement entries and resets all member balances to zero.

### 6. Peer Verification ("Show to verify")
- **In-Person Receipt Confirmation**: Bookkeeper presents expense confirmation screen to a companion.
- **Verification Badges**: Tapping "Confirm I've seen this" attaches immutable confirmation records displayed as `✅ [Name]` on expense cards.

---

## 🔮 Product Roadmap & Backlog

### Phase 2: Enhanced Intelligence & Formats
- [ ] **On-Device LayoutLMv3 / Document AI**:
  - Transition from heuristic regex OCR to quantized on-device neural network (LayoutLMv3 or MobileNet-OCR) for structured receipt extraction (items, taxes, discounts).
- [ ] **Multi-Currency Support with Offline Cache**:
  - Record expenses in local currencies (EUR, USD, JPY, GBP, TRY, etc.).
  - Periodic background sync of daily exchange rate tables with offline interpolation.
- [ ] **PDF & CSV Export**:
  - Generation of printable expense reports and CSV spreadsheets for business trip reimbursement.

### Phase 3: Wireless Mesh Sync
- [ ] **Bluetooth Low Energy (BLE) / Wi-Fi Direct Sync**:
  - Automatic background discovery of companion devices within 10 meters.
  - P2P sync without requiring physical camera alignment on QR codes.
- [ ] **NFC Tap-to-Join**:
  - Tap phone-to-phone to exchange group invite tokens and recent snapshots.

### Phase 4: Privacy & Security
- [ ] **Biometric App Lock**:
  - Secure application access using FaceID / TouchID / Android Biometrics (`expo-local-authentication`).
- [ ] **Encrypted Snapshots**:
  - Optional AES-GCM password encryption for exported snapshots and QR payloads.
