# icons/

> **Purpose**: Custom standalone SVG icon library — semantic delivery and logistics icons.

## File Catalog

| File | Icon |
|------|------|
| `index.ts` | Barrel re-export of all icons |
| `CheckmarkIcon.tsx` | ✓ Checkmark |
| `DeliveryTruckIcon.tsx` | 🚚 Delivery truck |
| `LockedDoorIcon.tsx` | 🔒 Door with padlock |
| `MapPinRerouteIcon.tsx` | 📍 GPS pin with dashed reroute |
| `PackageDeliveredIcon.tsx` | 📦 Open parcel with checkmark |
| `RescueRadarIcon.tsx` | 📡 Radar sweep with blip |
| `WhatsAppChatIcon.tsx` | 💬 Speech bubble with lines |

All icons accept `IconProps`: `size` (default 24), `className`, `aria-hidden="true"`.

## Agent Cheat Sheet

- To add a new icon: Create `YourIcon.tsx` with `IconProps`, add to `index.ts` barrel export
