# ADR 002: Choosing WatermelonDB over AsyncStorage & Plain SQLite

## Status
**Accepted** (2026-10-27)

## Context & Problem Statement
ValorTrip requires local data persistence on iOS and Android devices. The data model is inherently relational:
- A `Group` has multiple `Members`.
- An `Expense` has multiple `Payers` (who paid what part of the bill), multiple `Shares` (who consumed what part), and multiple `Confirmations`.
- A `Settlement` records debt payments between two `Members`.

We needed a storage layer that maintains relational data integrity, performs well with hundreds of transactions, and provides automatic reactivity to React components without manual cache invalidation.

## Decision Drivers
- **Relational Integrity**: Foreign keys, cascades, and structured schema definitions.
- **Lazy Loading & Memory Efficiency**: Rendering 100+ expenses should not load thousands of unneeded payer/share records into JavaScript heap memory at once.
- **Reactivity**: When an expense is added or modified, the group balance, expense list, and settlement projections should re-render automatically.
- **Performance**: JSI (JavaScript Interface) direct communication with native SQLite without asynchronous bridge serialization bottlenecks.
- **Offline Schema Migrations**: Safe database upgrades across future application releases.

## Considered Options

### 1. `AsyncStorage` / `react-native-mmkv` (Key-Value Stores)
- *Pros*: Extremely simple API, zero native compilation overhead.
- *Cons*:
  - Lacks relational queries; requires storing the whole trip state as one giant JSON blob.
  - Adding a single expense requires serializing and writing the entire state tree.
  - No indexing or partial querying; high risk of race conditions and memory spikes as trip history grows.

### 2. Plain `expo-sqlite`
- *Pros*: Full relational SQL support directly in Expo.
- *Cons*:
  - Requires writing raw SQL strings for every join and mutation.
  - No built-in reactive observable pattern (developers must write manual event emitters or state reconcilers).
  - High boilerplate for mapping relational rows into typed domain entities.

### 3. Realm
- *Pros*: Powerful object database with live objects.
- *Cons*: Heavy native binary size, complex native bindings, and licensing uncertainties.

### 4. WatermelonDB (`@nozbe/watermelondb`) (Chosen)
- *Pros*:
  - Built specifically for high-performance React Native applications on top of SQLite.
  - **Lazy Loading**: Only minimal IDs and requested fields are loaded into JS memory; associated children (`@children('shares')`) load on demand.
  - **Observable Queries**: Built-in RxJS observables (`query.observe()`, `withObservables` HOC or hooks) allow components to automatically re-render when underlying SQLite rows mutate.
  - **JSI Driver**: Executes queries directly on native threads via C++ JSI without JSON bridge serialization.
  - **Formal Schema & Migrations**: Strongly typed table definitions, column types, and automated migration runner.

## Decision Outcome
We adopted **WatermelonDB** with its native SQLite JSI driver as the primary persistence layer.

### Key Architecture & Implementation Details:
- **Models**:
  - `Group` (`src/db/models/index.ts`)
  - `Member` (with active lifecycle tracking)
  - `Expense` (with `@children('payers')`, `@children('shares')`, `@children('confirmations')`)
  - `Payer`, `Share`, `Confirmation`, `Settlement`
- **Transactions**:
  - Batch creation and updates run inside `database.write(async () => { ... })` ensuring atomicity (ACID properties).
- **Observer Hydration**:
  - Scanning a QR code executes a single batch transaction that fast-forwards existing SQLite rows using WatermelonDB's internal `batch()` API, eliminating UI flicker.

## Consequences
- **Positive**:
  - Instant UI responsiveness: Screens reflect changes immediately as database writes resolve.
  - Scalability: The app remains smooth with hundreds of expenses and dozens of participants.
  - Robust typing: TypeScript models enforce field types across the entire codebase.
- **Negative & Trade-offs**:
  - WatermelonDB requires decorator support in Babel/TypeScript (`@babel/plugin-proposal-decorators`).
  - `@date` decorator converts timestamp numbers (`0`) into `new Date(0)`, requiring proper boundary checks for nullable timestamps (resolved in ADR / Bugfix for `left_at`).
