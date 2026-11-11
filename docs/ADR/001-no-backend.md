# ADR 001: Zero-Backend Architecture (Offline-First + Optical QR Sync)

## Status
**Accepted** (2026-10-27)

## Context & Problem Statement
Traditional group expense tracking applications (e.g., Splitwise, Tricount) rely on central cloud backends, user authentication (OAuth/passwords), and continuous internet connectivity.

In real-world group travel scenarios (hiking in mountains, international travel without local roaming, airplanes, remote road trips):
1. **Connectivity is unstable or completely absent**: Requiring internet access to split a restaurant bill or taxi fare causes immediate failure.
2. **Onboarding friction**: Forcing 5–10 travel companions to download an app, create an account, verify email/phone, and join a group kills adoption. In practice, one person ("the bookkeeper") handles the numbers, while others just want to know how much they owe.
3. **Operational costs & privacy concerns**: Running central cloud servers incurs ongoing hosting, database, and maintenance costs, while storing users' personal financial logs centrally creates privacy and compliance risks.

## Decision Drivers
- **100% Offline Usability**: The app must function completely without cellular data or Wi-Fi.
- **Zero Friction for Companions**: Companions should see real-time figures without registering accounts.
- **Zero Infrastructure Cost**: No cloud servers, no managed databases, no API keys to maintain for core functionality.
- **Privacy by Design**: Financial records never leave users' physical hardware unless explicitly shared.

## Considered Options
1. **Central Cloud Backend (Node.js/PostgreSQL or Firebase/Supabase)**:
   - *Pros*: Automatic continuous sync across all users with bi-directional conflict resolution.
   - *Cons*: Fails completely offline; requires accounts; recurring infrastructure expenses; security overhead.
2. **Local P2P Networking (Bluetooth Low Energy / Wi-Fi Direct Mesh)**:
   - *Pros*: Offline device-to-device wireless sync.
   - *Cons*: OS permission hurdles (location access, Bluetooth prompts on iOS/Android); connection drops; platform fragmentation.
3. **Single Bookkeeper Model with Optical QR Code Sync (Chosen)**:
   - *Pros*: Works 100% offline; zero permissions beyond standard camera; instant transfer via light; zero accounts.
   - *Cons*: Read-only mirror on companion devices; QR code optical density limits payload size (~2KB).

## Decision Outcome
We adopted the **Single Bookkeeper (Owner) + Read-Only Optical QR Synchronization** model.

### Key Architecture:
- **Single Source of Truth**: The trip creator (Bookkeeper) holds the authoritative local SQLite database.
- **Optical Sync Engine**:
  - Entire trip state (members, expenses, payers, shares, settlements) is serialized into a versioned compact JSON schema.
  - Payload is compressed using DEFLATE (level 9) via `fflate` and encoded as Base64 (`valortrip://snapshot/<base64>`).
  - Companions scan the QR directly from the bookkeeper's screen using the device camera (`expo-camera`).
  - Companion's local database is fast-forwarded in a single atomic transaction.
- **Air-Gap Fallback**:
  - If a group's transaction history exceeds the optical scanning threshold (~2048 bytes), the app automatically offers native file sharing (`.json` via AirDrop, Bluetooth, or messaging apps using `expo-sharing`).
- **Owner Authentication**:
  - Handled via hardware-backed UUID in `expo-secure-store`, preventing accidental overwrite of group ownership.

## Consequences
- **Positive**:
  - Instant zero-setup onboarding for any group member in under 3 seconds.
  - Guaranteed operation in airplanes, wilderness, or foreign countries with no SIM card.
  - Zero ongoing server hosting expenses.
- **Negative & Trade-offs**:
  - Companions cannot directly record expenses from their own devices into the master ledger without re-scanning or passing changes through the bookkeeper. This trade-off was evaluated and deemed acceptable because in 95% of travel groups, one dedicated person acts as the primary organizer.
