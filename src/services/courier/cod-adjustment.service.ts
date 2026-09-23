/**
 * cod-adjustment.service.ts
 * Idempotent courier COD balance adjustment, overpayment safeguarding,
 * reconciliation, and manual fallback alerting.
 */

import { Types } from 'mongoose';
import { Order, Merchant, AuditLog, Shipment } from '../../models';
import { logisticsService, CarrierConfig } from '../logistics.service';
import { encryptionService } from '../encryption.service';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';

export interface CodAdjustmentParams {
  orderId: string;
  paymentId: string;
  paidAmountInInr: number;
}

export interface CodAdjustmentResult {
  success: boolean;
  previousCodAmount: number;
  newCodAmount: number;
  isOverpayment: boolean;
  overpaymentAmount?: number;
  manualActionRequired: boolean;
  message: string;
}

export class CodAdjustmentService {
  private static instance: CodAdjustmentService;

  private constructor() {}

  public static getInstance(): CodAdjustmentService {
    if (!CodAdjustmentService.instance) {
      CodAdjustmentService.instance = new CodAdjustmentService();
    }
    return CodAdjustmentService.instance;
  }

  /**
   * Adjust courier collectable COD amount after full or partial online payment.
   */
  public async adjustCodAmount(params: CodAdjustmentParams): Promise<CodAdjustmentResult> {
    const { orderId, paymentId, paidAmountInInr } = params;

    logger.info('Evaluating courier COD adjustment', { orderId, paymentId, paidAmountInInr });

    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const merchant = await Merchant.findById(order.merchantId);
    if (!merchant) {
      throw new Error(`Merchant not found: ${order.merchantId}`);
    }

    // ─── 1. Idempotency Guard ───
    const existingAdjustment = await AuditLog.findOne({
      orderId: order._id,
      action: 'COD_AMENDMENT',
      'payload.paymentId': paymentId,
    });

    if (existingAdjustment) {
      logger.info('COD amendment already processed for payment — skipping duplicate', { orderId, paymentId });
      return {
        success: true,
        previousCodAmount: existingAdjustment.payload?.previousCodAmount ?? 0,
        newCodAmount: existingAdjustment.payload?.newCodAmount ?? 0,
        isOverpayment: false,
        manualActionRequired: false,
        message: 'Duplicate payment adjustment skipped (already applied)',
      };
    }

    // ─── 2. Calculate New Collectable Amount & Overpayment ───
    const originalCod = order.orderValue || 0;
    let newCod = originalCod - paidAmountInInr;
    let isOverpayment = false;
    let overpaymentAmount = 0;

    if (newCod < 0) {
      isOverpayment = true;
      overpaymentAmount = Math.abs(newCod);
      newCod = 0; // Clamp collectable to 0

      logger.warn('Overpayment detected during COD adjustment', {
        orderId,
        originalCod,
        paidAmountInInr,
        overpaymentAmount,
      });

      await AuditLog.create({
        merchantId: merchant._id,
        orderId: order._id,
        action: 'cod_overpayment_detected',
        source: 'cod_adjustment_service',
        payload: { paymentId, originalCod, paidAmountInInr, overpaymentAmount },
        status: 'success',
      });
    }

    // ─── 3. Carrier Configuration ───
    const cc: any = merchant.carrierConfig || {};
    let apiToken: string | undefined;
    let carrierEmail: string | undefined;
    let carrierPassword: string | undefined;

    try {
      if (cc.apiToken) apiToken = encryptionService.decrypt(cc.apiToken);
      else if (cc.apiKey) apiToken = encryptionService.decrypt(cc.apiKey);
      if (cc.email) carrierEmail = encryptionService.decrypt(cc.email);
      if (cc.password) carrierPassword = encryptionService.decrypt(cc.password);
    } catch (err: any) {
      logger.error('Failed to decrypt carrier credentials for COD adjustment', { merchantId: merchant._id });
    }

    const carrierConfig: CarrierConfig = {
      provider: (order.carrier as any) || cc.provider || 'shiprocket',
      apiToken,
      email: carrierEmail || config.shiprocket.email,
      password: carrierPassword || config.shiprocket.password,
    };

    // ─── 4. Call Courier to Amend COD ───
    let carrierCallSuccess = false;
    let carrierResponseData: any = null;
    let manualActionRequired = false;

    if (order.awb && order.carrier) {
      try {
        const updateResult = await logisticsService.adjustCodAmount(
          order.carrier,
          {
            awb: order.awb,
            newCodAmount: newCod,
            reason: `Online payment received (paymentId: ${paymentId})`,
          },
          carrierConfig
        );

        carrierCallSuccess = updateResult.success;
        carrierResponseData = updateResult.carrierResponse;

        if (!updateResult.success) {
          manualActionRequired = true;
          logger.warn('Carrier rejected COD amendment — manual hub intervention required', {
            awb: order.awb,
            carrier: order.carrier,
            message: updateResult.message,
          });
        }
      } catch (carrierErr: any) {
        manualActionRequired = true;
        logger.error('Exception calling carrier for COD adjustment', {
          awb: order.awb,
          error: carrierErr.message,
        });
      }
    } else {
      // No AWB yet (order not shipped) -> manual action not needed, just update internal order
      carrierCallSuccess = true;
    }

    // ─── 5. Update Shipment Registry Record ───
    try {
      let shipment = await Shipment.findOne({ merchantId: merchant._id, awbNumber: order.awb });
      if (!shipment && order.awb) {
        shipment = await Shipment.create({
          merchantId: merchant._id,
          orderId: order._id,
          awbNumber: order.awb,
          carrier: order.carrier || 'shiprocket',
          originalCodAmount: originalCod,
          currentCodAmount: newCod,
          normalizedStatus: 'ndr_detected',
        });
      }

      if (shipment) {
        shipment.currentCodAmount = newCod;
        shipment.codAmendmentStatus = manualActionRequired ? 'MANUAL_REQUIRED' : 'AMENDED';
        shipment.codAmendmentHistory.push({
          paymentId,
          previousAmount: originalCod,
          newAmount: newCod,
          amendedAt: new Date(),
          responseDetails: carrierResponseData,
        });
        await shipment.save();
      }
    } catch (shipmentErr: any) {
      logger.warn('Failed to update Shipment model during COD amendment', { error: shipmentErr?.message });
    }

    // ─── 6. Record Audit Trail ───
    await AuditLog.create({
      merchantId: merchant._id,
      orderId: order._id,
      action: manualActionRequired ? 'COD_AMENDMENT_MANUAL_REQUIRED' : 'COD_AMENDMENT',
      source: 'cod_adjustment_service',
      payload: {
        paymentId,
        previousCodAmount: originalCod,
        newCodAmount: newCod,
        isOverpayment,
        overpaymentAmount,
        manualActionRequired,
        carrierResponse: carrierResponseData,
      },
      status: manualActionRequired ? 'failed' : 'success',
      error: manualActionRequired ? 'Carrier rejected automated COD amendment' : undefined,
    });

    return {
      success: carrierCallSuccess,
      previousCodAmount: originalCod,
      newCodAmount: newCod,
      isOverpayment,
      overpaymentAmount,
      manualActionRequired,
      message: manualActionRequired
        ? 'Carrier does not support automated COD reduction; manual dispatch notification raised'
        : 'COD amount successfully updated with carrier',
    };
  }
}

export const codAdjustmentService = CodAdjustmentService.getInstance();
