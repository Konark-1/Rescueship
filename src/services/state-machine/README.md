# state-machine/

> **Purpose**: Order lifecycle state machine — enforces legal state transitions and rejects stale webhooks.

## File Catalog

| File | Role | Key Exports |
|------|------|-------------|
| `order-state-machine.service.ts` | State machine | `OrderStateMachineService` singleton — `transitionOrder()`, `canTransition()`, `isTerminal()`, `isSemiTerminal()`, `isStaleEvent()`, `onTerminalTransition()` |

## Architecture & Data Flow

Called by ALL webhook handlers, NDR service, order service, and ndr-lifecycle job. Guards every order status change. Validates transition legality. Rejects out-of-order webhook timestamps. Protects terminal states.

**Constants**: `TERMINAL_STATES = ['delivered', 'returned', 'cancelled', 'lost']`, `SEMI_TERMINAL_STATES = ['rto_initiated', 'rto']`, `ALLOWED_TRANSITIONS` (strict transition graph).

## Key Invariants

- Terminal states (`delivered`, `returned`, `cancelled`, `lost`) are FINAL — no transitions allowed out
- `rto_initiated` is semi-terminal — can transition to `ndr_rescued` or `delivered` if customer engages
- Stale webhooks (older timestamp than current) are silently dropped
- Every transition is logged to `AuditLog`
- `onTerminalTransition()` cancels active escalation jobs and settles NDR cases
