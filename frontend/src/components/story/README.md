# story/

> **Purpose**: Interactive scroll-linked story scenes for the landing page — narrative chapters driving conversion.

## File Catalog

| File | Role |
|------|------|
| `ScrollStory.tsx` | Primitives: `StoryProgress`, `ChapterIndicator`, `StoryChapter`, `usePhase(progress, start, end)` |
| `HeroScene.tsx` | Chapter 1: Live parcel tracker, fake "Door Locked" stamp, animated courier scooter |
| `CostScene.tsx` | Chapter 2: ₹430 RTO loss breakdown (CAC + forward + reverse + repack), animated fill bars |
| `RescueScene.tsx` | Chapter 3: Interactive WhatsApp simulator with customer response branching |

## Architecture & Data Flow

`ScrollStory.tsx` binds `useScroll()` progress to sticky chapters. Each scene receives a `MotionValue<number>` progress prop and uses `usePhase()` to clamp animation thresholds. Used exclusively by `../../pages/LandingPage.tsx`.
