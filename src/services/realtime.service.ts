/**
 * realtime.service.ts
 * ─────────────────────────────────────────────────────────────
 * Server-Sent Events (SSE) service for real-time dashboard updates.
 * Pushes order status changes, NDR events, and payment confirmations
 * to connected merchant dashboards without polling.
 */

import { Response } from 'express';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface RealtimeEvent {
  type: 'order_update' | 'ndr_detected' | 'ndr_rescued' | 'payment_received' | 'capacity_warning' | 'stats_refresh';
  merchantId: string;
  payload: Record<string, any>;
  timestamp: string;
}

class RealtimeService extends EventEmitter {
  private static instance: RealtimeService;
  private clients: Map<string, Set<Response>> = new Map(); // merchantId → Set<SSE connections>
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.setMaxListeners(1000);
    this.startHeartbeat();
  }

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Register a new SSE client connection for a merchant.
   */
  public addClient(merchantId: string, res: Response): void {
    if (!this.clients.has(merchantId)) {
      this.clients.set(merchantId, new Set());
    }
    this.clients.get(merchantId)!.add(res);

    // Send initial connection event
    this.sendToClient(res, {
      type: 'stats_refresh',
      merchantId,
      payload: { message: 'Connected to RescueShip real-time feed' },
      timestamp: new Date().toISOString(),
    });

    logger.info('SSE client connected', {
      merchantId,
      totalClients: this.clients.get(merchantId)!.size,
    });

    // Cleanup on disconnect
    res.on('close', () => {
      this.removeClient(merchantId, res);
    });
  }

  /**
   * Remove a disconnected SSE client.
   */
  public removeClient(merchantId: string, res: Response): void {
    const clientSet = this.clients.get(merchantId);
    if (clientSet) {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.clients.delete(merchantId);
      }
    }
    logger.info('SSE client disconnected', { merchantId });
  }

  /**
   * Broadcast an event to all connected clients of a specific merchant.
   * Called from services (NDR, Order, Payment) after state changes.
   */
  public broadcast(event: RealtimeEvent): void {
    const clientSet = this.clients.get(event.merchantId);
    if (!clientSet || clientSet.size === 0) return;

    for (const res of clientSet) {
      this.sendToClient(res, event);
    }

    logger.debug('SSE broadcast sent', {
      merchantId: event.merchantId,
      type: event.type,
      clientCount: clientSet.size,
    });
  }

  /**
   * Convenience: Emit an order update event.
   */
  public emitOrderUpdate(merchantId: string, orderId: string, status: string, extra?: Record<string, any>): void {
    this.broadcast({
      type: 'order_update',
      merchantId,
      payload: { orderId, status, ...extra },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Convenience: Emit NDR detected event.
   */
  public emitNdrDetected(merchantId: string, orderId: string, reason: string, isFake: boolean): void {
    this.broadcast({
      type: 'ndr_detected',
      merchantId,
      payload: { orderId, reason, isFakeRemark: isFake },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Convenience: Emit payment received event.
   */
  public emitPaymentReceived(merchantId: string, orderId: string, amount: number): void {
    this.broadcast({
      type: 'payment_received',
      merchantId,
      payload: { orderId, amount },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Convenience: Emit capacity warning (80% threshold).
   */
  public emitCapacityWarning(merchantId: string, used: number, limit: number): void {
    this.broadcast({
      type: 'capacity_warning',
      merchantId,
      payload: { used, limit, percentage: Math.round((used / limit) * 100) },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get total connected client count (for health monitoring).
   */
  public getConnectedClientCount(): number {
    let total = 0;
    for (const [, clients] of this.clients) {
      total += clients.size;
    }
    return total;
  }

  private sendToClient(res: Response, event: RealtimeEvent): void {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      // Client disconnected, will be cleaned up
    }
  }

  private startHeartbeat(): void {
    // Send heartbeat every 30 seconds to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      for (const [merchantId, clients] of this.clients) {
        for (const res of clients) {
          try {
            res.write(`:heartbeat ${Date.now()}\n\n`);
          } catch (err) {
            this.removeClient(merchantId, res);
          }
        }
      }
    }, 30000);
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const [, clients] of this.clients) {
      for (const res of clients) {
        try {
          res.end();
        } catch (err) { /* ignore */ }
      }
    }
    this.clients.clear();
  }
}

export const realtimeService = RealtimeService.getInstance();
