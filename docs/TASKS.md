# Task Execution Ledger

This document maintains the task history, completed engineering milestones, and current active/pending work items for **ValorTrip**.

---

## 🏁 Completed Tasks (v1.0.0 MVP)

### Foundation & Architecture
- [x] Configure Expo SDK 58 project with React Native 0.88 and TypeScript.
- [x] Integrate **NativeWind v4** and TailwindCSS for high-performance mobile UI.
- [x] Configure **WatermelonDB** with SQLite JSI native driver and Babel decorator plugin.
- [x] Implement schema definition with indexed tables: `groups`, `members`, `expenses`, `payers`, `shares`, `confirmations`, `settlements`.
- [x] Implement hardware-backed device identification via `expo-secure-store`.

### Core Algorithms & Logic
- [x] Implement integer-cent money utilities (`splitEqually`, `calcTip`, `validateExpense`) in `src/lib/money.ts`.
- [x] Implement greedy bipartite Minimum Cash Flow algorithm in `src/lib/balance.ts`.
- [x] Create automated standalone algorithm verification test suite (`test-algorithms.ts`).
- [x] Build optical snapshot compressor using `fflate` DEFLATE level 9 in `src/lib/snapshot.ts`.

### UI Screens & Navigation (Expo Router)
- [x] Root layout with `DatabaseProvider` and global styles (`src/app/_layout.tsx`).
- [x] Home screen displaying active trips and quick summary cards (`src/app/index.tsx`).
- [x] Trip creation screen with owner and initial member inputs (`src/app/create-group.tsx`).
- [x] Trip dashboard with balance breakdown and expense cards (`src/app/group/[id].tsx`).
- [x] Two-step expense entry screen with payer amounts and consumer allocations (`src/app/add-expense.tsx`).
- [x] Expense editing and recalculation screen (`src/app/edit-expense.tsx`).
- [x] Settle-Up screen with minimum transfer plan and batch settlement action (`src/app/settle.tsx`).
- [x] Member management screen with join/leave lifecycle actions (`src/app/members.tsx`).
- [x] Optical snapshot generator with QR code and file export fallback (`src/app/share-snapshot.tsx`).
- [x] Camera QR code scanner for joining trips as observers (`src/app/join-group.tsx`).
- [x] Pre-close trip integrity check and archiving flow (`src/app/close-trip.tsx`).

### QA & Verification
- [x] Fix `Member.isActive` Unix Epoch 0 bug in model getter (`src/db/models/index.ts`).
- [x] Fix race condition during QR code join in `src/app/join-group.tsx`.
- [x] Execute automated End-to-End QA test suite on physical **Google Pixel 7 Pro** via Artemis + ADB.
- [x] Validate zero TypeScript errors (`npx tsc --noEmit`).
- [x] Verify release bundle export (`npx expo export --platform android`).

---

## 🚧 In Progress

- [x] **Technical Documentation & ADRs**:
  - [x] Write `docs/CHANGELOG.md`
  - [x] Write `docs/ADR/001-no-backend.md`
  - [x] Write `docs/ADR/002-watermelondb-choice.md`
  - [x] Write `docs/ADR/003-min-cash-flow.md`
  - [x] Write `docs/BUGS.md`
  - [x] Write `docs/FEATURES.md`
  - [x] Write `docs/TASKS.md`
  - [x] Link documentation in root `README.md` and commit to Git.

---

## 📋 Backlog & Todo Items

### Phase 2: Offline OCR & Receipt Intelligence
- [ ] Research on-device quantized models for structured receipt parsing (LayoutLMv3 vs ML Kit).
- [ ] Implement receipt image edge detection and automatic perspective unwarping.
- [ ] Add itemized split UI where users check individual receipt line items.

### Phase 3: International Travel Support
- [ ] Add multi-currency selector to expense creation.
- [ ] Implement local SQLite cache for European Central Bank / Forex exchange rates.
- [ ] Add trip base currency conversion with historical rate freezing.

### Phase 4: Export & Sharing
- [ ] Implement PDF report generator for business trip expense reimbursement.
- [ ] Implement CSV export compatible with Microsoft Excel and Google Sheets.
- [ ] Explore Bluetooth Low Energy (BLE) background sync between nearby companion devices.

### Future / Nice-to-have
- [ ] **Дизайн и Ассеты (Design & Assets)**: Сгенерировать и добавить крутые иконки, сплэш-скрины (заставки) и графику для Google Play (`icon.png` 1024x1024, `adaptive-icon.png`, `feature-graphic.png` 1024x500). Обновить `app.json`, чтобы приложение выглядело профессионально. Спецификация подготовлена в [`assets/design/README.md`](../assets/design/README.md).

