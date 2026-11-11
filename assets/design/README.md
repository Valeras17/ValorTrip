# 🎨 ValorTrip Design & Branding Assets Specification

This directory holds the specifications, source vectors, and export guidelines for the future redesign and app store publication of **ValorTrip**.

> **Note**: This folder is currently a specification placeholder. Image assets will be generated and placed here during the visual design phase.

---

## 📐 Required Asset Specifications

### 1. Application Icons

| Asset Name | Target Resolution | Format | Notes / Constraints |
|---|---|---|---|
| `icon.png` | **1024 × 1024 px** | PNG-24 (no alpha for iOS) | Master app icon. Square, full-bleed design, no rounded corners (applied by OS). |
| `android-icon-foreground.png` | **432 × 432 px** | PNG-32 (with alpha) | Adaptive icon foreground layer. Essential artwork must reside in the central **safe zone** (diameter 264 px / 66 dp). |
| `android-icon-background.png` | **432 × 432 px** | PNG-24 | Adaptive icon background layer. Solid brand dark-slate (`#0F172A`) or subtle gradient. |
| `android-icon-monochrome.png` | **432 × 432 px** | PNG-32 (single color + alpha) | Android 13+ Material You themed icon tinting. Pure flat silhouette. |
| `favicon.png` | **48 × 48 px** / **192 × 192 px** | PNG-32 | Browser tab icon for Expo web builds and documentation. |

---

### 2. Splash Screen (Launch Screen)

| Asset Name | Target Resolution | Format | Notes / Constraints |
|---|---|---|---|
| `splash-icon.png` | **288 × 288 px** (or 200 × 200) | PNG-32 (transparent) | Centered brand emblem rendered over `backgroundColor: "#0F172A"`. |
| `splash.png` *(Full screen)* | **1284 × 2778 px** | PNG-24 | High-resolution background for device boot sequences and splash animations. |

---

### 3. Google Play Store & Distribution Graphics

| Asset Name | Target Resolution | Format | Notes / Constraints |
|---|---|---|---|
| `feature-graphic.png` | **1024 × 500 px** | JPEG or PNG-24 (no alpha) | Mandatory Google Play store listing banner. High-impact branding with logo and tagline (*"Offline-First Group Expense Tracker"*). |
| `promo-graphic.png` | **180 × 120 px** | PNG-24 | Secondary promotional tile for legacy Android storefront placements. |
| `screenshots/` | **1080 × 2400 px** (min 4 screens) | PNG-24 | Clean device frames showing core user journeys: <br>1. Trip Dashboard & Real-Time Balance <br>2. Two-Step Split & "Paid All" <br>3. Instant Optical QR Sync <br>4. Min Cash Flow Settlement ("All settled!") |

---

### 4. Status Bar & Notifications

| Asset Name | Target Resolution | Format | Notes / Constraints |
|---|---|---|---|
| `notification-icon.png` | **96 × 96 px** (24 × 24 dp) | PNG-32 | Flat white silhouette on transparent background for Android status bar push alerts. |

---

## 🎨 Brand Identity & Color Tokens

- **Background (Canvas)**: `#0F172A` (Tailwind `slate-900`)
- **Card / Surface**: `#1E293B` (Tailwind `slate-800`)
- **Primary Brand (Indigo / Violet)**: `#6366F1` / `#4F46E5`
- **Success / Settle (Emerald)**: `#10B981` (Tailwind `emerald-500`)
- **Debtor / Alert (Rose)**: `#F43F5E` (Tailwind `rose-500`)
- **Typography Base**: `#F8FAFC` (Tailwind `slate-50`) and `#94A3B8` (Tailwind `slate-400`)

---

## 🛠️ Next Steps for Implementation
1. Prepare SVG vector sources in Figma / Illustrator.
2. Export raster PNGs according to the resolution grid above.
3. Replace placeholder files in `assets/` and update references in `app.json`.
