# context/

> **Purpose**: React context providers — global authentication state management.

## File Catalog

| File | Key Exports |
|------|-------------|
| `AuthContext.tsx` | `AuthProvider`, `useAuth()` |

## State & Methods

| State | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | `{ id, name, email, platform, onboardingStatus }` |
| `token` | `string \| null` | JWT authentication token |
| `loading` | `boolean` | Initial localStorage hydration lock |
| `isAuthenticated` | `boolean` | Derived: `!!token` |

| Method | Description |
|--------|-------------|
| `login(token, user)` | Saves to state + `localStorage` |
| `logout()` | Clears state + `localStorage` |
| `updateUser(partial)` | Merges partial user updates |

## Key Invariants

- `loading` is true until initial hydration completes — prevents flash redirects
- `logout()` clears both memory state AND localStorage
- `isAuthenticated` is derived (`!!token`), not independently stored
