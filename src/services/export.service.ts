/**
 * export.service.ts
 * ─────────────────────────────────────────────────────────────
 * CSV/JSON data export for Scale plan merchants.
 * Supports: Orders, NDR Reports, Revenue Summary, Carrier Performance.
 */

import { Types } from 'mongoose';
import { Transform } from 'stream';
import { Order } from '../models';
import { analyticsService } from './analytics.service';
import { logger } from '../utils/logger';

export type ExportFormat = 'csv' | 'json';
export type ExportType = 'orders' | 'ndr_report' | 'revenue_summary' | 'carrier_performance';

export interface ExportOptions {
  merchantId: string;
  type: ExportType;
  format: ExportFormat;
  startDate?: Date;
  endDate?: Date;
  statusFilter?: string[];
}

export interface ExportResult {
  filename: string;
  contentType: string;
  data: string;
  rowCount: number;
}

export class ExportService {
  private static instance: ExportService;
  private constructor() {}

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  public async generateExport(options: ExportOptions): Promise<ExportResult> {
    const { merchantId, type, format, startDate, endDate, statusFilter } = options;
    const mId = new Types.ObjectId(merchantId);

    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    logger.info('Generating data export', { merchantId, type, format });

    let rows: Record<string, any>[] = [];

    switch (type) {
      case 'orders':
        rows = await this.exportOrders(mId, start, end, statusFilter);
        break;
      case 'ndr_report':
        rows = await this.exportNdrReport(mId, start, end);
        break;
      case 'revenue_summary':
        rows = await this.exportRevenueSummary(mId, start, end);
        break;
      case 'carrier_performance':
        rows = await this.exportCarrierPerformance(merchantId, start, end);
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    const filename = `rescueship_${type}_${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}.${format}`;

    let data: string;
    let contentType: string;

    if (format === 'csv') {
      data = this.toCSV(rows);
      contentType = 'text/csv; charset=utf-8';
    } else {
      data = JSON.stringify(rows, null, 2);
      contentType = 'application/json; charset=utf-8';
    }

    return { filename, contentType, data, rowCount: rows.length };
  }

  public async streamExportOrders(
    merchantId: string,
    res: any,
    options?: { startDate?: Date; endDate?: Date; statusFilter?: string[] }
  ): Promise<void> {
    return streamExportOrders(merchantId, res, options);
  }

  private async exportOrders(
    merchantId: Types.ObjectId,
    start: Date,
    end: Date,
    statusFilter?: string[]
  ): Promise<Record<string, any>[]> {
    const query: any = {
      merchantId,
      createdAt: { $gte: start, $lte: end },
    };
    if (statusFilter && statusFilter.length > 0) {
      query.status = { $in: statusFilter };
    }

    const cursor = Order.find(query).sort({ createdAt: -1 }).cursor();
    const rows: Record<string, any>[] = [];
    for await (const doc of cursor) {
      rows.push(formatOrderExportRow(doc));
    }
    return rows;
  }

  private async exportNdrReport(
    merchantId: Types.ObjectId,
    start: Date,
    end: Date
  ): Promise<Record<string, any>[]> {
    const cursor = Order.find({
      merchantId,
      createdAt: { $gte: start, $lte: end },
      'ndr.detectedAt': { $ne: null },
    })
      .sort({ 'ndr.detectedAt': -1 })
      .cursor();

    const rows: Record<string, any>[] = [];
    for await (const o of cursor) {
      const doc = o as any;
      rows.push({
        order_id: doc.externalOrderId,
        customer_name: doc.customerName || '',
        customer_phone: doc.customerPhone || '',
        amount: doc.orderValue || 0,
        carrier: doc.carrier || '',
        awb: doc.awb || '',
        ndr_reason: doc.ndr?.reason || '',
        ndr_detected_at: doc.ndr?.detectedAt ? new Date(doc.ndr.detectedAt).toISOString() : '',
        ndr_resolved_at: doc.ndr?.resolvedAt ? new Date(doc.ndr.resolvedAt).toISOString() : '',
        resolution: doc.ndr?.resolution || '',
        final_status: doc.status || '',
        escalation_attempts: doc.ndr?.escalationAttempts || 0,
        address_mode: doc.ndr?.addressMode || '',
        is_fake_remark: doc.ndr?.isFakeRemark ? 'Yes' : 'No',
      });
    }
    return rows;
  }

  private async exportRevenueSummary(
    merchantId: Types.ObjectId,
    start: Date,
    end: Date
  ): Promise<Record<string, any>[]> {
    const RTO_COST_PER_ORDER = 430;

    const [converted, rescued, rto] = await Promise.all([
      Order.find({
        merchantId,
        status: 'converted_to_prepaid',
        createdAt: { $gte: start, $lte: end },
      }).lean(),
      Order.find({
        merchantId,
        status: 'ndr_rescued',
        createdAt: { $gte: start, $lte: end },
      }).lean(),
      Order.find({
        merchantId,
        status: 'rto',
        createdAt: { $gte: start, $lte: end },
      }).lean(),
    ]);

    const convertedRevenue = converted.reduce((sum, o: any) => sum + (o.orderValue || 0), 0);
    const rescuedRevenue = rescued.reduce((sum, o: any) => sum + (o.orderValue || 0), 0);
    const rtoLoss = rto.length * RTO_COST_PER_ORDER;

    return [{
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
      total_orders: converted.length + rescued.length + rto.length,
      cod_converted: converted.length,
      ndr_rescued: rescued.length,
      rto_orders: rto.length,
      revenue_from_conversions_inr: convertedRevenue,
      revenue_from_rescues_inr: rescuedRevenue,
      total_revenue_saved_inr: convertedRevenue + rescuedRevenue,
      rto_loss_avoided_inr: (converted.length + rescued.length) * RTO_COST_PER_ORDER,
      actual_rto_loss_inr: rtoLoss,
      net_savings_inr: (converted.length + rescued.length) * RTO_COST_PER_ORDER - rtoLoss,
    }];
  }

  private async exportCarrierPerformance(
    merchantId: string,
    start: Date,
    end: Date
  ): Promise<Record<string, any>[]> {
    const stats = await analyticsService.getCarrierPerformance(merchantId, {
      startDate: start,
      endDate: end,
    });

    return stats.map((s) => ({
      carrier: s.carrier,
      total_ndr: s.totalNDR,
      rescued: s.rescued,
      rto: s.rto,
      rescue_rate_percent: s.rescueRate,
    }));
  }

  private toCSV(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const csvHeaders = headers.map((h) => `"${h}"`).join(',');

    const csvRows = rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '""';
          let str = String(val);
          // Prevent CSV / DDE injection (matches formula triggers even if preceded by whitespace, tabs, or zero-width chars)
          if (/^[\s\u0000-\u001f\u007f-\u009f\u200B-\u200D\uFEFF]*[=@+\-\t\r|%]/.test(str)) {
            str = `'${str}`;
          }
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }
}

export const ORDER_EXPORT_HEADERS = [
  'order_id',
  'customer_name',
  'customer_phone',
  'amount',
  'payment_method',
  'status',
  'carrier',
  'awb',
  'platform',
  'ndr_reason',
  'ndr_detected_at',
  'created_at',
  'updated_at',
];

export function formatOrderExportRow(o: any): Record<string, any> {
  return {
    order_id: o.externalOrderId || '',
    customer_name: o.customerName || '',
    customer_phone: o.customerPhone || '',
    amount: o.orderValue || 0,
    payment_method: o.paymentMethod || '',
    status: o.status || '',
    carrier: o.carrier || '',
    awb: o.awb || '',
    platform: o.platform || '',
    ndr_reason: o.ndr?.reason || '',
    ndr_detected_at: o.ndr?.detectedAt ? new Date(o.ndr.detectedAt).toISOString() : '',
    created_at: o.createdAt ? new Date(o.createdAt).toISOString() : '',
    updated_at: o.updatedAt ? new Date(o.updatedAt).toISOString() : '',
  };
}

export function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Prevent CSV / DDE injection (matches formula triggers even if preceded by whitespace, tabs, or zero-width chars)
  if (/^[\s\u0000-\u001f\u007f-\u009f\u200B-\u200D\uFEFF]*[=@+\-\t\r|%]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function transformToExportFormat(): Transform {
  let headerWritten = false;

  return new Transform({
    objectMode: true,
    transform(doc, _encoding, callback) {
      let output = '';
      if (!headerWritten) {
        output += ORDER_EXPORT_HEADERS.map((h) => `"${h}"`).join(',') + '\n';
        headerWritten = true;
      }
      const row = formatOrderExportRow(doc);
      const csvLine = ORDER_EXPORT_HEADERS.map((h) => escapeCsvField(row[h])).join(',') + '\n';
      output += csvLine;
      callback(null, output);
    },
    flush(callback) {
      if (!headerWritten) {
        this.push(ORDER_EXPORT_HEADERS.map((h) => `"${h}"`).join(',') + '\n');
      }
      callback();
    },
  });
}

export async function streamExportOrders(
  merchantId: string,
  res: any,
  options?: { startDate?: Date; endDate?: Date; statusFilter?: string[] }
): Promise<void> {
  const mId = new Types.ObjectId(merchantId);
  const end = options?.endDate || new Date();
  const start = options?.startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  const query: any = {
    merchantId: mId,
    createdAt: { $gte: start, $lte: end },
  };
  if (options?.statusFilter && options.statusFilter.length > 0) {
    query.status = { $in: options.statusFilter };
  }

  const filename = `orders-${Date.now()}.csv`;
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }

  const cursor = Order.find(query).sort({ createdAt: -1 }).cursor();
  const transformer = transformToExportFormat();

  await new Promise<void>((resolve, reject) => {
    cursor
      .pipe(transformer)
      .pipe(res)
      .on('finish', resolve)
      .on('error', (err: any) => {
        logger.error('Stream export failed', { merchantId, error: err.message });
        reject(err);
      });
  });
}

export const exportService = ExportService.getInstance();
