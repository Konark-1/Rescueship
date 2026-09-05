import { useState, useEffect, useRef, useCallback } from 'react';

export interface RealtimeEvent {
  type: 'order_update' | 'ndr_detected' | 'ndr_rescued' | 'payment_received' | 'capacity_warning' | 'stats_refresh';
  merchantId: string;
  payload: Record<string, any>;
  timestamp: string;
}

interface Options {
  onOrderUpdate?: (p: any) => void;
  onNdrDetected?: (p: any) => void;
  onPaymentReceived?: (p: any) => void;
  onCapacityWarning?: (p: any) => void;
  onStatsRefresh?: () => void;
}

const MAX_RETRIES = 5;

export function useRealtime(token: string | null, options?: Options, enabled = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const stoppedRef = useRef(false);

  const connect = useCallback(() => {
    if (!token || !enabled || stoppedRef.current) return;

    const url = `${import.meta.env.VITE_API_URL || ''}/api/realtime/stream?token=${token}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => { setIsConnected(true); attemptsRef.current = 0; };
    es.onerror = () => {
      setIsConnected(false);
      es.close();
      attemptsRef.current += 1;
      if (stoppedRef.current || attemptsRef.current > MAX_RETRIES) return; // stop runaway loops (e.g. 403)
      retryRef.current = setTimeout(connect, 5000);
    };

    (['order_update', 'ndr_detected', 'ndr_rescued', 'payment_received', 'capacity_warning', 'stats_refresh'] as const).forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const ev: RealtimeEvent = JSON.parse(e.data);
          setLastEvent(ev);
          if (type === 'order_update') options?.onOrderUpdate?.(ev.payload);
          if (type === 'ndr_detected') options?.onNdrDetected?.(ev.payload);
          if (type === 'payment_received') options?.onPaymentReceived?.(ev.payload);
          if (type === 'capacity_warning') options?.onCapacityWarning?.(ev.payload);
          if (type === 'stats_refresh') options?.onStatsRefresh?.();
        } catch { /* ignore parse errors */ }
      });
    });
  }, [token, enabled, options]);

  useEffect(() => {
    stoppedRef.current = false;
    attemptsRef.current = 0;
    connect();
    return () => {
      stoppedRef.current = true;
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  return { isConnected, lastEvent };
}
