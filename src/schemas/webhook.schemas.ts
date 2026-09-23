/**
 * webhook.schemas.ts
 * Enterprise Zod schemas for webhook payload validation
 */

import { z } from 'zod';

export const ShiprocketWebhookSchema = z.object({
  awb: z.string().min(1, 'AWB is required'),
  current_status: z.string().optional(),
  status: z.string().optional(),
  current_status_id: z.union([z.number(), z.string()]).optional(),
  shipment_status: z.string().optional(),
  shipment_id: z.union([z.string(), z.number()]).optional(),
  order_id: z.union([z.string(), z.number()]).optional(),
  courier_name: z.string().optional(),
  courier: z.string().optional(),
  scans: z.array(z.any()).optional(),
  etd: z.string().optional(),
  ndr_status: z.string().optional(),
  remark: z.string().optional(),
  reason: z.string().optional(),
  attempt: z.union([z.number(), z.string()]).optional(),
  pickup_date: z.string().optional(),
  delivered_date: z.string().optional(),
  rto_delivered_date: z.string().optional(),
  location: z.string().optional(),
  customer_phone: z.string().optional(),
  phone: z.string().optional(),
  consignee_phone: z.string().optional(),
  attempt_time: z.string().optional(),
}).passthrough();

export const WhatsAppInboundMessageSchema = z.object({
  object: z.string().optional(),
  entry: z.array(
    z.object({
      id: z.string().optional(),
      changes: z.array(
        z.object({
          field: z.string().optional(),
          value: z.object({
            messaging_product: z.string().optional(),
            metadata: z.object({
              display_phone_number: z.string().optional(),
              phone_number_id: z.string().optional(),
            }).optional(),
            contacts: z.array(z.any()).optional(),
            messages: z.array(
              z.object({
                from: z.string().min(1),
                id: z.string().min(1),
                timestamp: z.string().optional(),
                type: z.string(),
                text: z.object({ body: z.string() }).optional(),
                button: z.object({ payload: z.string().optional(), text: z.string().optional() }).optional(),
                interactive: z.object({
                  type: z.string().optional(),
                  button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
                  list_reply: z.object({ id: z.string(), title: z.string() }).optional(),
                }).optional(),
                location: z.object({
                  latitude: z.number(),
                  longitude: z.number(),
                  name: z.string().optional(),
                  address: z.string().optional(),
                }).optional(),
                image: z.object({ id: z.string().optional(), mime_type: z.string().optional() }).optional(),
                document: z.object({ id: z.string().optional(), filename: z.string().optional() }).optional(),
              }).passthrough()
            ).optional(),
            statuses: z.array(
              z.object({
                id: z.string(),
                status: z.enum(['sent', 'delivered', 'read', 'failed']),
                timestamp: z.string().optional(),
                recipient_id: z.string().optional(),
                errors: z.array(z.any()).optional(),
              }).passthrough()
            ).optional(),
          }).passthrough(),
        }).passthrough()
      ).optional(),
    }).passthrough()
  ).optional(),
}).passthrough();

export const RazorpayPaymentWebhookSchema = z.object({
  entity: z.string().optional(),
  account_id: z.string().optional(),
  event: z.string().min(1, 'Event is required'),
  contains: z.array(z.string()).optional(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string().min(1),
        amount: z.number().nonnegative(),
        currency: z.string().optional(),
        status: z.string().optional(),
        order_id: z.string().nullable().optional(),
        invoice_id: z.string().nullable().optional(),
        method: z.string().optional(),
        notes: z.record(z.string(), z.any()).optional(),
      }).passthrough(),
    }).optional(),
    payment_link: z.object({
      entity: z.object({
        id: z.string().min(1),
        amount: z.number().nonnegative().optional(),
        status: z.string().optional(),
        notes: z.record(z.string(), z.any()).optional(),
      }).passthrough(),
    }).optional(),
  }).passthrough(),
}).passthrough();

export const ShopifyOrderWebhookSchema = z.object({
  id: z.union([z.number(), z.string()]),
  order_number: z.union([z.number(), z.string()]).optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  total_price: z.union([z.string(), z.number()]).optional(),
  financial_status: z.string().optional(),
  fulfillment_status: z.string().nullable().optional(),
  fulfillments: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).optional(),
      tracking_number: z.string().nullable().optional(),
      tracking_company: z.string().nullable().optional(),
      tracking_numbers: z.array(z.string()).optional(),
    }).passthrough()
  ).optional(),
  customer: z.object({
    id: z.union([z.number(), z.string()]).optional(),
    phone: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
  }).optional(),
  shipping_address: z.object({
    phone: z.string().nullable().optional(),
    address1: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    zip: z.string().nullable().optional(),
  }).optional(),
}).passthrough();
