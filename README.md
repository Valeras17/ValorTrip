# 🌍 ValorTrip

> **Production-Ready, Offline-First Group Expense Tracker for Travelers**  
> *Zero backend. Zero registration. 100% local SQLite. One bookkeeper + observer sync via compressed QR codes.*

---

## 💡 Concept & Architecture

When traveling in remote areas (mountains, abroad, planes, off-grid trails), traditional expense splitters like Splitwise fail due to flaky or nonexistent mobile connectivity. Furthermore, requiring every participant to register an account and remember credentials is a major friction point.

**ValorTrip** solves this with a pragmatic architectural model:
- **Single Bookkeeper (Owner)**: One person creates the group on their device and records expenses, payers, and splits.
- **Read-Only Observers**: Travel companions scan a **single compressed QR code** directly off the bookkeeper's screen.
- **No Backend**: SQLite database runs entirely on-device via **WatermelonDB** with JSI (JavaScript Interface).
- **Zero Account Creation**: Ownership is anchored to an anonymous hardware-backed UUID in secure storage (`expo-secure-store`).

```
┌─────────────────────────────────────────────────────────────────┐
│                     Bookkeeper (Owner Device)                   │
│   • Records Expenses & Multi-Payer splits                       │
│   • Manages Active/Inactive Member Lifecycles                   │
│   • Calculates Min Cash Flow (≤ N-1 Transfers)                  │
│   • Generates Compressed Snapshot (< 2KB QR / JSON File)       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    [QR Code / AirDrop / Chat]
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Observer (Companion Device)                  │
│   • Scans QR via Expo Camera / Imports Snapshot                 │
│   • Fast-forwards Local SQLite Mirror (Read-Only)               │
│   • Views Real-Time Net Balances & Suggested Settlements        │
│   • One-Tap Expense Confirmations                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Expo SDK 58+ (React Native 0.88) | Native cross-platform performance with modern runtime |
| **Navigation** | Expo Router v58 (File-based) | Type-safe, deep-linkable declarative routing |
| **Styling** | NativeWind v4 + TailwindCSS v3 | High-performance styling compiled to native StyleSheet rules |
| **Database** | WatermelonDB (`@nozbe/watermelondb`) | Fast SQLite with lazy loading and observable queries |
| **State** | Zustand | Lightweight client UI state (read-only flags, modals) |
| **QR Sync** | `react-native-qrcode-svg` + `expo-camera` | Instant offline optical synchronization |
| **Compression** | `fflate` (Deflate / Inflate) | Microsecond-speed sync compression fitting full trip data in < 2KB |
| **Storage** | `expo-secure-store` | Hardware-backed owner device identification |
| **Fallback Export** | `expo-sharing` + `expo-file-system` | Native file share sheet when snapshot exceeds QR threshold |
| **Animations & Haptics** | `react-native-reanimated` + `expo-haptics` | Tactile, fluid 60fps micro-interactions |

---

## 🧠 Key Engineering Decisions

### 1. Integer Cents Only — Zero Floating Point Errors
Currency is never represented as standard JavaScript `number` floats. All amounts are strictly stored and computed as **integer cents**:
- Store: `1250` cents (integer)
- Display: `formatMoney(1250, 'USD')` $\to$ `"$12.50"`
- Even Split: `Math.floor(total / count)` for each share, with the integer remainder assigned to the **last participant**.
- Validation: Guaranteed invariant $\sum \text{Payers} \equiv \sum \text{Shares} \equiv \text{Total}$.

### 2. Minimum Cash Flow Algorithm (Greedy Bipartite Matching)
Instead of pairwise debts resulting in confusing circular exchanges ($O(N^2)$ transactions), ValorTrip runs a greedy min-cash-flow reduction:
1. Calculates net balance for every member:
   $$\text{net}(m) = \sum \text{Paid} - \sum \text{Share} + \sum \text{Settlements Received} - \sum \text{Settlements Paid}$$
2. Partitions into Creditors ($\text{net} > 0$) and Debtors ($\text{net} < 0$).
3. Greedily matches the largest debtor with the largest creditor:
   $$\text{transfer} = \min(|\text{debtor.net}|, \text{creditor.net})$$
4. Guaranteed to settle all debts in **at most $N - 1$ transactions**.
5. Mathematically preserves conservation of money ($\sum \text{Transfers} \equiv \sum \text{Credits} \equiv |\sum \text{Debts}|$).

### 3. Sub-2KB Snapshot Compression for QR Codes
QR codes have practical density limitations on smartphone screens (~2048 bytes for reliable camera scanning in diverse lighting conditions).
- ValorTrip serializes the group state into a compact schema versioned JSON payload.
- Compresses the byte stream synchronously using `fflate` Deflate level 9.
- Encodes as Base64 with URL schema `valortrip://snapshot/<base64>`.
- Typical trip with 5 members, 15 expenses, and settlements compresses to **~500 bytes**, comfortably beneath the 2KB limit.
- If data exceeds 2048 bytes, the UI automatically prompts a fallback to native file export (`.json` via `expo-sharing`).

### 4. Integrity Checks & Trip Lifecycle
Before a trip can be marked as Closed:
- **Departed Member Check**: Ensures members who left early do not have an outstanding net balance.
- **Settlement Verification**: Validates whether all suggested transfers have been logged as settled.

---

## 📱 App Structure & File Map

```
valortrip/
├── src/
│   ├── app/                    # Expo Router Screens
│   │   ├── _layout.tsx         # Root layout with DatabaseProvider
│   │   ├── index.tsx           # Groups list & quick stats
│   │   ├── create-group.tsx    # Create new trip group
│   │   ├── join-group.tsx      # QR Scanner for joining as observer
│   │   ├── members.tsx         # Add, deactivate, reactivate members
│   │   ├── add-expense.tsx     # 2-step expense creation (payers + shares)
│   │   ├── edit-expense.tsx    # Edit existing expense & recalculate
│   │   ├── settle.tsx          # Net balance sheet & min cash flow actions
│   │   ├── close-trip.tsx      # Pre-close checks & trip archiving
│   │   ├── share-snapshot.tsx  # Dynamic QR generator & fallback file exporter
│   │   └── group/
│   │       └── [id].tsx        # Group detail view with balance bar & cards
│   ├── components/
│   │   └── ui/                 # Reusable design system primitives
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Field.tsx
│   │       └── EmptyState.tsx
│   ├── db/                     # WatermelonDB Models & Schema
│   │   ├── schema.ts           # SQLite schema tables
│   │   ├── migrations.ts       # Database migrations
│   │   └── models/index.ts     # Group, Member, Expense, Payer, Share, Settlement
│   ├── features/               # Domain-driven action controllers
│   │   ├── expenses/           # Expense creation & confirmation logic
│   │   ├── groups/             # Group creation & membership status
│   │   ├── settlement/         # Balance calculations & batch settlements
│   │   └── snapshot/           # Snapshot generation & observer hydration
│   └── lib/                    # Pure core utilities & algorithms
│       ├── balance.ts          # Net balance + Min Cash Flow algorithm
│       ├── money.ts            # Integer cents, tip calc, equal split
│       ├── snapshot.ts         # fflate compression & URL parsing
│       ├── id.ts               # NanoID generator & secure device ID
│       └── store.ts            # Zustand UI store
├── test-algorithms.ts          # Automated test suite for core algorithms
├── tailwind.config.js          # NativeWind design system tokens
└── package.json
```

---

## 🧪 Testing Core Algorithms

ValorTrip comes with an isolated automated test suite that validates the mathematical invariants and snapshot round-trips:

```bash
npx tsx test-algorithms.ts
```

Output:
```text
--- Testing Money Utils ---
✅ PASSED: splitEqually: 1000 / 3 = [333, 333, 334]
✅ PASSED: splitEqually: sum equals total
✅ PASSED: splitEqually: 7 / 4 sum equals 7
✅ PASSED: calcTip: 10% of 1000 is 100
✅ PASSED: calcTip: 15% of 1000 is 150
✅ PASSED: calcTip: none is 0
✅ PASSED: validateExpense: valid when payers and shares match
✅ PASSED: validateExpense: invalid when payers mismatch
✅ PASSED: validateExpense: invalid when shares mismatch

--- Testing Balance & Min Cash Flow ---
✅ PASSED: A net is +2000
✅ PASSED: B net is -1000
✅ PASSED: C net is -1000
✅ PASSED: Min cash flow produces <= 2 transfers (got 2)
✅ PASSED: Both B and C pay 1000 to A
✅ PASSED: All settled after recording calculated transfers
✅ PASSED: 5 members produce <= 4 transfers (got 4)
✅ PASSED: Conservation of money: sum of transfers (4500) === sum of credits (4500)

--- Testing Snapshot Compression & Round-trip ---
✅ PASSED: encodeSnapshot produces non-empty base64 string
✅ PASSED: Snapshot size (532 bytes) is well under 2KB QR limit
✅ PASSED: Decoded groupId matches
✅ PASSED: Decoded groupName matches
✅ PASSED: Decoded members count matches
✅ PASSED: Decoded expense title matches
✅ PASSED: Decoded confirmation status matches

🎉 ALL ALGORITHM & SNAPSHOT TESTS PASSED PERFECTLY!
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- Expo Go app or Android / iOS simulator / development build

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/valortrip.git
cd valortrip

# Install dependencies
npm install --legacy-peer-deps

# Verify TypeScript compilation
npx tsc --noEmit

# Start Expo development server
npx expo start
```

---

## 📄 License
MIT License. Crafted with clean architecture for modern, decentralized mobile applications.
