import { useState, useEffect, useRef, useCallback } from 'react';
import { useOrderStore } from '../store/OrderStore';

export interface RealtimeEvent {
  type:
    | 'order_update'
    | 'ndr_detected'
    | 'ndr_rescued'
    | 'payment_received'
    | 'cod_converted'
    | 'order_cancelled'
    | 'capacity_warning'
    | 'stats_refresh';
  merchantId: string;
  payload: Record<string, any>;
  timestamp: string;
}

interface Options {
  onOrderUpdate?: (p: any) => void;
  onNdrDetected?: (p: any) => void;
  onPaymentReceived?: (p: any) => void;
  onNdrRescued?: (p: any) => void;
  onOrderCancelled?: (p: any) => void;
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

  // Keep options in a ref so changes to callbacks never cause unnecessary reconnections
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const { updateOrderStatus, incrementMetric } = useOrderStore();

  const connect = useCallback(() => {
    if (!token || !enabled || stoppedRef.current) return;

    if (esRef.current) {
      esRef.current.close();
    }

    const apiUrl = import.meta.env.VITE_API_URL || '';
    const url = `${apiUrl}/api/realtime/stream?token=${token}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      attemptsRef.current = 0;
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      attemptsRef.current += 1;
      if (stoppedRef.current || attemptsRef.current > MAX_RETRIES) return;
      retryRef.current = setTimeout(connect, 5000);
    };

    const parsePayload = (e: MessageEvent): RealtimeEvent | null => {
      try {
        return JSON.parse(e.data);
      } catch {
        return null;
      }
    };

    const eventTypes = [
      'order_update',
      'ndr_detected',
      'ndr_rescued',
      'payment_received',
      'cod_converted',
      'order_cancelled',
      'capacity_warning',
      'stats_refresh',
    ] as const;

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        const ev = parsePayload(e);
        if (!ev) return;

        setLastEvent(ev);
        const data = ev.payload || {};

        // 🛡️ TARGETED STATE SYNC: Directly update global OrderStore
        switch (type) {
          case 'order_update':
            if (data.orderId && data.status) {
              updateOrderStatus(data.orderId, data.status, data.metadata);
            }
            optionsRef.current?.onOrderUpdate?.(data);
            break;

          case 'ndr_detected':
            if (data.orderId) {
              updateOrderStatus(data.orderId, 'ndr_detected');
              incrementMetric('activeNdrCases', 1);
            }
            optionsRef.current?.onNdrDetected?.(data);
            break;

          case 'payment_received':
          case 'cod_converted':
            if (data.orderId) {
              updateOrderStatus(data.orderId, 'converted_to_prepaid', { paymentMethod: 'prepaid' });
              incrementMetric('totalConversions', 1);
              if (data.amount) incrementMetric('revenueSaved', Number(data.amount) || 0);
            }
            optionsRef.current?.onPaymentReceived?.(data);
            break;

          case 'ndr_rescued':
            if (data.orderId) {
              updateOrderStatus(data.orderId, 'ndr_rescued');
              incrementMetric('activeNdrCases', -1);
              if (data.amount || data.rtoFeeSaved) {
                incrementMetric('revenueSaved', Number(data.amount || data.rtoFeeSaved) || 0);
              }
            }
            optionsRef.current?.onNdrRescued?.(data);
            break;

          case 'order_cancelled':
            if (data.orderId) {
              updateOrderStatus(data.orderId, 'cancelled');
            }
            optionsRef.current?.onOrderCancelled?.(data);
            break;

          case 'capacity_warning':
            optionsRef.current?.onCapacityWarning?.(data);
            break;

          case 'stats_refresh':
            optionsRef.current?.onStatsRefresh?.();
            break;
        }
      });
    });
  }, [token, enabled, updateOrderStatus, incrementMetric]);

  useEffect(() => {
    stoppedRef.current = false;
    attemptsRef.current = 0;
    connect();
    return () => {
      stoppedRef.current = true;
      esRef.current?.close();
      esRef.current = null;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  return { isConnected, lastEvent };
}
