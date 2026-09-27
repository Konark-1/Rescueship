import { create } from 'zustand';

export interface Order {
  id?: string;
  _id?: string;
  orderId?: string;
  externalOrderId?: string;
  status: string;
  orderValue?: number;
  customerName?: string;
  customerPhone?: string;
  phone?: string;
  paymentMethod?: string;
  awb?: string;
  carrier?: string;
  createdAt?: string;
  timeline?: { event: string; date: string }[];
  rtoRisk?: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
    recommendedAction?: 'auto_ship' | 'whatsapp_verify' | 'require_deposit' | 'manual_review';
    scoredAt?: string | Date;
  };
}

export interface LiveMetrics {
  activeNdrCases: number;
  revenueSaved: number;
  totalConversions: number;
}

interface OrderStore {
  orders: Order[];
  liveMetrics: LiveMetrics;
  setOrders: (orders: Order[]) => void;
  updateOrderStatus: (orderId: string, newStatus: string, metadata?: Partial<Order>) => void;
  incrementMetric: (metric: keyof LiveMetrics, amount: number) => void;
  resetMetrics: () => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  liveMetrics: { activeNdrCases: 0, revenueSaved: 0, totalConversions: 0 },

  setOrders: (orders) => set({ orders }),

  updateOrderStatus: (orderId, newStatus, metadata) => set((state) => ({
    orders: state.orders.map((o) => {
      const match =
        o._id === orderId ||
        o.id === orderId ||
        o.externalOrderId === orderId ||
        o.orderId === orderId;

      return match
        ? { ...o, status: newStatus, ...(metadata || {}) }
        : o;
    }),
  })),

  incrementMetric: (metric, amount) => set((state) => ({
    liveMetrics: {
      ...state.liveMetrics,
      [metric]: Math.max(0, state.liveMetrics[metric] + amount), // Prevent negative counters
    },
  })),

  resetMetrics: () => set({
    liveMetrics: { activeNdrCases: 0, revenueSaved: 0, totalConversions: 0 }
  }),
}));
