import { logger } from '../utils/logger';
import { Merchant, IMerchant } from '../models/Merchant';

export interface SandboxState {
  enabled: boolean;
  activatedAt?: Date;
  testRescuesSent: number;
  testRescuesSucceeded: number;
  graduationThreshold: number;
  graduated: boolean;
  graduatedAt?: Date;
}

export interface SandboxNDRSimulation {
  orderId: string;
  customerPhone: string;
  reason: 'rto_attempt_failed' | 'customer_unavailable' | 'wrong_address' | 'refused_delivery';
  courier: string;
  awb: string;
}

const SIMULATED_REASONS: SandboxNDRSimulation['reason'][] = [
  'rto_attempt_failed',
  'customer_unavailable',
  'wrong_address',
  'refused_delivery',
];

class SandboxService {
  /**
   * Toggle sandbox mode for a merchant.
   * When enabled, ALL outbound WhatsApp messages redirect to ownerPhone.
   */
  async setSandboxMode(merchantId: string, enabled: boolean): Promise<SandboxState> {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error(`Merchant ${merchantId} not found`);

    const sandbox = (merchant as any).sandbox || this.defaultState();

    if (enabled && !sandbox.enabled) {
      sandbox.enabled = true;
      sandbox.activatedAt = new Date();
      sandbox.testRescuesSent = 0;
      sandbox.testRescuesSucceeded = 0;
      sandbox.graduated = false;
      sandbox.graduatedAt = undefined;
      logger.info(`[Sandbox] Enabled for ${merchantId}`, { merchantId });
    } else if (!enabled && sandbox.enabled) {
      sandbox.enabled = false;
      logger.info(`[Sandbox] Disabled for ${merchantId}`, { merchantId });
    }

    (merchant as any).sandbox = sandbox;
    await merchant.save();
    return sandbox;
  }

  async getSandboxState(merchantId: string): Promise<SandboxState> {
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) throw new Error(`Merchant ${merchantId} not found`);
    return (merchant as any).sandbox || this.defaultState();
  }

  /**
   * Resolve the actual recipient phone number.
   * In sandbox mode, ALL messages go to the merchant's ownerPhone.
   */
  resolveRecipient(merchant: IMerchant, intendedPhone: string): string {
    const sandbox = (merchant as any).sandbox as SandboxState | undefined;
    if (sandbox?.enabled && !sandbox.graduated) {
      return (merchant as any).ownerPhone || intendedPhone;
    }
    return intendedPhone;
  }

  /**
   * Track a sandbox test rescue attempt.
   */
  async recordTestRescue(merchantId: string, success: boolean): Promise<SandboxState> {
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error(`Merchant ${merchantId} not found`);

    const sandbox: SandboxState = (merchant as any).sandbox || this.defaultState();
    sandbox.testRescuesSent += 1;
    if (success) sandbox.testRescuesSucceeded += 1;

    // Auto-graduation check
    if (
      !sandbox.graduated &&
      sandbox.testRescuesSucceeded >= sandbox.graduationThreshold
    ) {
      sandbox.graduated = true;
      sandbox.graduatedAt = new Date();
      logger.info(`[Sandbox] Merchant ${merchantId} graduated from sandbox`, {
        attempts: sandbox.testRescuesSent,
        successes: sandbox.testRescuesSucceeded,
      });
    }

    (merchant as any).sandbox = sandbox;
    await merchant.save();
    return sandbox;
  }

  /**
   * Generate a simulated NDR payload for sandbox testing.
   * Merchant can trigger this to see the full rescue flow without a real courier event.
   */
  generateSimulatedNDR(merchantId: string, ownerPhone: string): SandboxNDRSimulation {
    const reason = SIMULATED_REASONS[Math.floor(Math.random() * SIMULATED_REASONS.length)];
    return {
      orderId: `SANDBOX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      customerPhone: ownerPhone, // always self in sandbox
      reason,
      courier: 'SandboxSim',
      awb: `SIM${Date.now().toString(36).toUpperCase()}`,
    };
  }

  /**
   * Check if merchant is eligible to go live (graduated or sandbox disabled).
   */
  isLiveEligible(merchant: IMerchant): boolean {
    const sandbox = (merchant as any).sandbox as SandboxState | undefined;
    if (!sandbox) return true; // never entered sandbox
    if (!sandbox.enabled) return true; // manually disabled
    return sandbox.graduated;
  }

  private defaultState(): SandboxState {
    return {
      enabled: false,
      testRescuesSent: 0,
      testRescuesSucceeded: 0,
      graduationThreshold: 3,
      graduated: false,
    };
  }
}

export const sandboxService = new SandboxService();
