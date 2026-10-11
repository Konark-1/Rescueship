import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from './useRealtime';

export function useDashboardSSE(onNotification?: (msg: string, type: 'info' | 'success' | 'warning') => void) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  useRealtime(
    token,
    {
      onNdrDetected: (payload) => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-orders-attention'] });
        onNotification?.(
          `New NDR: Order #${payload?.externalOrderId || payload?.orderId || ''} (${payload?.reason || 'Undelivered'})`,
          'warning'
        );
      },
      onNdrRescued: (payload) => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-roi-records'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-roi'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-orders-attention'] });
        onNotification?.(
          `Order #${payload?.externalOrderId || payload?.orderId || ''} Rescued! ₹${payload?.saved || 140} saved`,
          'success'
        );
      },
      onPaymentReceived: () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-roi-records'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-roi'] });
      },
      onCapacityWarning: () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      },
      onStatsRefresh: () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-roi-records'] });
        queryClient.invalidateQueries({ queryKey: ['analytics-roi'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-orders-attention'] });
      },
    },
    Boolean(token)
  );
}
