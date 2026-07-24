/**
 * useRealtime.ts
 * ─────────────────────────────────────────────────────────────
 * React hook for consuming SSE real-time events from the backend.
 * Usage: const { lastEvent, isConnected } = useRealtime(token);
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface RealtimeEvent {
  type: 'order_update' | 'ndr_detected' | 'ndr_rescued' | 'payment_received' | 'capacity_warning' | 'stats_refresh';
  merchantId: string;
  payload: Record<string, any>;
  timestamp: string;
}

interface UseRealtimeOptions {
  onOrderUpdate?: (payload: any) => void;
  onNdrDetected?: (payload: any) => void;
  onPaymentReceived?: (payload: any) => void;
  onCapacityWarning?: (payload: any) => void;
  onStatsRefresh?: () => void;
}

export function useRealtime(token: string | null, options?: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!token) return;

    // EventSource doesn't support custom headers, so we pass token as query param
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/realtime/stream?token=${token}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      console.log('[SSE] Connected to real-time feed');
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };

    // Listen for specific event types
    const eventTypes = ['order_update', 'ndr_detected', 'ndr_rescued', 'payment_received', 'capacity_warning', 'stats_refresh'];

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const event: RealtimeEvent = JSON.parse(e.data);
          setLastEvent(event);

          // Dispatch to specific handlers
          switch (event.type) {
            case 'order_update':
              options?.onOrderUpdate?.(event.payload);
              break;
            case 'ndr_detected':
              options?.onNdrDetected?.(event.payload);
              break;
            case 'payment_received':
              options?.onPaymentReceived?.(event.payload);
              break;
            case 'capacity_warning':
              options?.onCapacityWarning?.(event.payload);
              break;
            case 'stats_refresh':
              options?.onStatsRefresh?.();
              break;
          }
        } catch (err) {
          console.warn('[SSE] Failed to parse event:', err);
        }
      });
    });
  }, [token, options]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { isConnected, lastEvent };
}
