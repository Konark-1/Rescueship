import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtime } from '../src/hooks/useRealtime';
import { useOrderStore } from '../src/store/OrderStore';
import { TIERS, PLANS, CYCLES } from '../src/config/pricing.config';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 1;
  close = vi.fn();
  onopen: any = null;
  onerror: any = null;
  onmessage: any = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

describe('useRealtime Architectural Invariants (Invisible Trap #1)', () => {
  let originalEventSource: any;

  beforeEach(() => {
    MockEventSource.instances = [];
    originalEventSource = (globalThis as any).EventSource;
    (globalThis as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    (globalThis as any).EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  it('MUST NOT instantiate EventSource when token is null or empty', () => {
    renderHook(() => useRealtime(null));
    expect(MockEventSource.instances.length).toBe(0);

    renderHook(() => useRealtime(''));
    expect(MockEventSource.instances.length).toBe(0);
  });

  it('MUST NOT instantiate EventSource when enabled is false', () => {
    renderHook(() => useRealtime('valid-token-123', undefined, false));
    expect(MockEventSource.instances.length).toBe(0);
  });

  it('instantiates EventSource with query parameter token when token is present and enabled', () => {
    renderHook(() => useRealtime('valid-token-123', undefined, true));
    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toContain('token=valid-token-123');
  });

  it('closes EventSource cleanly upon unmount to eliminate memory leaks', () => {
    const { unmount } = renderHook(() => useRealtime('token-cleanup-test'));
    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0];

    unmount();
    expect(instance.close).toHaveBeenCalledTimes(1);
  });
});

describe('useOrderStore Zustand Telemetry Mutations', () => {
  beforeEach(() => {
    useOrderStore.setState({
      orders: [],
      liveMetrics: { activeNdrCases: 0, revenueSaved: 0, totalConversions: 0 },
    });
  });

  it('initializes with empty orders and zero metrics', () => {
    const state = useOrderStore.getState();
    expect(state.orders).toEqual([]);
    expect(state.liveMetrics.revenueSaved).toBe(0);
  });

  it('optimistically updates order status and merges metadata', () => {
    const initialOrders = [
      { orderId: '#1001', status: 'ndr_received', customerName: 'Aarav' },
      { orderId: '#1002', status: 'shipped', customerName: 'Rohan' },
    ];
    useOrderStore.getState().setOrders(initialOrders);

    act(() => {
      useOrderStore.getState().updateOrderStatus('#1001', 'rescued', {
        timeline: [{ event: 'Rescued via WhatsApp', date: 'Just now' }],
      });
    });

    const updated = useOrderStore.getState().orders;
    expect(updated[0].status).toBe('rescued');
    expect(updated[0].timeline?.[0].event).toBe('Rescued via WhatsApp');
    // Order #1002 remains untouched
    expect(updated[1].status).toBe('shipped');
  });

  it('accurately increments live metrics without mutation drift', () => {
    act(() => {
      useOrderStore.getState().incrementMetric('revenueSaved', 1400);
      useOrderStore.getState().incrementMetric('activeNdrCases', 3);
      useOrderStore.getState().incrementMetric('totalConversions', 1);
    });

    const metrics = useOrderStore.getState().liveMetrics;
    expect(metrics.revenueSaved).toBe(1400);
    expect(metrics.activeNdrCases).toBe(3);
    expect(metrics.totalConversions).toBe(1);

    act(() => {
      useOrderStore.getState().resetMetrics();
    });
    expect(useOrderStore.getState().liveMetrics.revenueSaved).toBe(0);
  });
});

describe('Canonical Pricing Configuration (The ₹4,999 Mandate)', () => {
  it('enforces canonical tier prices: Starter=4999, Growth=11999, Scale=24999, Fleet=44999', () => {
    const starter = TIERS.find((t) => t.key === 'starter');
    const growth = TIERS.find((t) => t.key === 'growth');
    const scale = TIERS.find((t) => t.key === 'scale');
    const fleet = TIERS.find((t) => t.key === 'fleet');

    expect(starter?.base).toBe(4999);
    expect(growth?.base).toBe(11999);
    expect(scale?.base).toBe(24999);
    expect(fleet?.base).toBe(44999);
  });

  it('correctly maps PLANS with respective order limits and monthly rates', () => {
    expect(PLANS.length).toBe(4);
    expect(PLANS[0].priceMonthly).toBe(4999);
    expect(PLANS[0].maxOrders).toBe(1000);
    expect(PLANS[1].priceMonthly).toBe(11999);
    expect(PLANS[2].priceMonthly).toBe(24999);
    expect(PLANS[3].priceMonthly).toBe(44999);
  });

  it('enforces canonical billing discount tiers: Quarterly (0%), Semi (15%), Annual (20%)', () => {
    const quarterly = CYCLES.find((c) => c.key === 'quarterly');
    const semi = CYCLES.find((c) => c.key === 'semi');
    const annual = CYCLES.find((c) => c.key === 'annual');

    expect(quarterly?.discount).toBe(0);
    expect(semi?.discount).toBe(0.15);
    expect(annual?.discount).toBe(0.20);
  });
});
