import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/** Escape a value for safe interpolation into HTML email bodies. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private isSmtpConfigured: boolean = false;
  private oauth2Client: OAuth2Client | null = null;
  private gmailUser: string | null = null;
  private isGmailApiConfigured: boolean = false;

  private constructor() {
    this.initTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initTransporter(): void {
    // 1. Check Gmail REST API (Port 443 / HTTPS - bypasses cloud SMTP blocks)
    const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const gUser = process.env.GMAIL_USER || process.env.SMTP_USER || 'konarkofficial@gmail.com';

    if (clientId && clientSecret && refreshToken) {
      this.oauth2Client = new OAuth2Client(clientId, clientSecret);
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      this.gmailUser = gUser;
      this.isGmailApiConfigured = true;
      logger.info('EmailService initialized with Gmail REST API (HTTPS port 443)', { user: gUser });
    } else {
      this.isGmailApiConfigured = false;
    }

    // 2. Fallback to Nodemailer SMTP
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      const cleanPass = pass.replace(/\s+/g, '');
      const isSecure = port === 465;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        auth: { user, pass: cleanPass },
        family: 4,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      } as any);
      this.isSmtpConfigured = true;
      logger.info('EmailService initialized with SMTP transport (IPv4)', { host, port, user, secure: isSecure });
    } else {
      this.isSmtpConfigured = false;
      if (!this.isGmailApiConfigured) {
        logger.info('EmailService initialized with fallback logging (credentials not fully provided)');
      }
    }
  }

  public getStatus() {
    return {
      isGmailApiConfigured: this.isGmailApiConfigured,
      gmailUser: this.gmailUser,
      isSmtpConfigured: this.isSmtpConfigured,
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null,
      user: process.env.SMTP_USER || null,
      hasPass: !!process.env.SMTP_PASS,
      hasRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
      from: process.env.SMTP_FROM || null,
      ownerNotifyEmail: process.env.OWNER_NOTIFY_EMAIL || null,
    };
  }

  public reinit(): void {
    this.initTransporter();
  }

  public async verifyConnection(): Promise<{ ok: boolean; transport: string; error?: string; host?: string; port?: number }> {
    // Check Gmail API first
    if (this.isGmailApiConfigured && this.oauth2Client) {
      try {
        const tokenRes = await this.oauth2Client.getAccessToken();
        const token = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token;
        if (!token) throw new Error('Failed to retrieve access token from refresh token');
        return { ok: true, transport: 'gmail_api_https' };
      } catch (err: any) {
        return { ok: false, transport: 'gmail_api_https', error: err.message };
      }
    }

    if (!this.transporter) {
      return { ok: false, transport: 'none', error: 'No email transport configured' };
    }
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    try {
      await this.transporter.verify();
      return { ok: true, transport: 'smtp', host, port };
    } catch (err: any) {
      return { ok: false, transport: 'smtp', error: `${err.name}: ${err.message} (code: ${err.code || 'N/A'})`, host, port };
    }
  }

  /**
   * Send email using Gmail REST API (HTTPS port 443) or SMTP transport or fallback to logging.
   */
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    const from = process.env.SMTP_FROM || `"RescueShip" <${this.gmailUser || 'konarkofficial@gmail.com'}>`;

    // 1. Gmail REST API over HTTPS (Port 443 - zero block on Render free tier)
    if (this.isGmailApiConfigured && this.oauth2Client) {
      try {
        const tokenRes = await this.oauth2Client.getAccessToken();
        const accessToken = typeof tokenRes === 'string' ? tokenRes : tokenRes?.token;
        if (!accessToken) {
          throw new Error('Could not obtain Gmail access token from refresh token');
        }

        const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
        const emailContent = [
          `From: ${from}`,
          `To: ${options.to}`,
          `Subject: ${utf8Subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: 7bit',
          '',
          options.html || options.text || '',
        ].join('\r\n');

        const raw = Buffer.from(emailContent)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await axios.post(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          { raw },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 12000,
          }
        );

        logger.info('Email sent successfully via Gmail REST API (HTTPS)', { to: options.to, subject: options.subject });
        return true;
      } catch (err: any) {
        logger.error('Gmail REST API dispatch failed, trying SMTP fallback', {
          error: err.response?.data?.error?.message || err.message,
          to: options.to,
        });
      }
    }

    // 2. SMTP Transport
    if (this.isSmtpConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        logger.info('Email sent successfully via SMTP', { messageId: info.messageId, to: options.to, subject: options.subject });
        return true;
      } catch (err: any) {
        logger.error('Failed to send email via SMTP, falling back to log', { error: err.message, to: options.to, subject: options.subject });
        this.logEmailFallback(from, options);
        return false;
      }
    }

    this.logEmailFallback(from, options);
    return true;
  }

  private logEmailFallback(from: string, options: EmailOptions): void {
    // Bodies can carry reset/onboarding tokens. Only dump them when explicitly opted in
    // for local development; never in production.
    const dumpBody = process.env.NODE_ENV !== 'production' && process.env.EMAIL_DEBUG_LOG_BODY === 'true';
    logger.info('[Email Fallback Log] SMTP not configured — email not sent', {
      from,
      to: options.to,
      subject: options.subject,
      ...(dumpBody ? { text: options.text } : { bodyBytes: (options.text || options.html || '').length }),
    });
  }

  /**
   * Send email verification token / link.
   */
  public async sendEmailVerificationToken(email: string, token: string, merchantName: string = 'Merchant'): Promise<boolean> {
    const appUrl = process.env.APP_URL || 'https://app.rescueship.io';
    const verifyUrl = `${appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    const subject = '✉️ Verify your RescueShip email address';
    const text = `Hello ${merchantName},\n\nPlease verify your email address by clicking the link below or entering verification token ${token}:\n${verifyUrl}\n\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>✉️ Verify Your Email Address</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>Thank you for signing up with RescueShip. Please verify your email address to activate all features of your account.</p>
      <p style="margin: 20px 0;">
        <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
      </p>
      <p>Or use verification token: <code>${token}</code></p>
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  public async sendVerificationEmail(email: string, token: string, merchantName?: string): Promise<boolean> {
    return this.sendEmailVerificationToken(email, token, merchantName);
  }

  /**
   * Send password reset email dispatch functionality.
   */
  public async sendPasswordResetEmail(email: string, token: string, merchantName: string = 'Merchant'): Promise<boolean> {
    const appUrl = process.env.APP_URL || 'https://app.rescueship.io';
    const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    const subject = '🔒 Password Reset Request - RescueShip';
    const text = `Hello ${merchantName},\n\nYou requested a password reset for your RescueShip account. Please reset your password by visiting:\n${resetUrl}\n\nAlternatively, use token: ${token}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>🔒 Password Reset Request</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>We received a request to reset the password for your RescueShip account.</p>
      <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #dc2626; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </p>
      <p>Or use reset token: <code>${token}</code></p>
      <p style="font-size: 12px; color: #888;">If you did not request a password reset, no further action is required.</p>
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  public async sendPasswordResetToken(email: string, token: string, merchantName?: string): Promise<boolean> {
    return this.sendPasswordResetEmail(email, token, merchantName);
  }

  /**
   * Send merchant welcome email.
   */
  public async sendMerchantWelcome(email: string, merchantName: string): Promise<boolean> {
    const subject = `Welcome to RescueShip, ${merchantName}! 🚀`;
    const text = `Hello ${merchantName},\n\nWelcome to RescueShip! We're excited to help you automate your NDR rescue and COD conversion.\n\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>Welcome to RescueShip! 🚀</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>Thank you for joining RescueShip. We're excited to help you automate your NDR rescue and COD conversions.</p>
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  public async sendWelcomeEmail(email: string, merchantName: string): Promise<boolean> {
    return this.sendMerchantWelcome(email, merchantName);
  }

  /**
   * Send low credits merchant alert.
   */
  public async sendLowCreditsAlert(email: string, merchantName: string, remainingCredits: number): Promise<boolean> {
    const subject = `⚠️ Action Required: Low Rescue Credits for ${merchantName}`;
    const text = `Hello ${merchantName},\n\nYour RescueShip rescue credits balance is running low (${remainingCredits} credits remaining). Please top up your account to ensure uninterrupted NDR rescue automation.\n\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>⚠️ Low Rescue Credits Alert</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>Your RescueShip rescue credits balance is running low: <strong>${remainingCredits} credits remaining</strong>.</p>
      <p>Please top up your account to ensure uninterrupted NDR rescue automation.</p>
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  public async sendLowCreditAlert(email: string, merchantName: string, remainingCredits: number): Promise<boolean> {
    return this.sendLowCreditsAlert(email, merchantName, remainingCredits);
  }

  /**
   * Send monthly summary report (Growth+ plan feature).
   */
  public async sendMonthlySummaryReport(
    email: string,
    merchantName: string,
    reportData: { totalOrders: number; rescuedOrders: number; rescueRate: number; totalRevenueSaved: number },
    plan: string = 'starter'
  ): Promise<boolean> {
    if (plan === 'starter' || plan === 'free_trial') {
      logger.info('Skipped monthly summary email for Starter plan merchant', { email, merchantName });
      return false;
    }

    const subject = `📊 Monthly Performance Summary Report for ${merchantName}`;
    const text = `Hello ${merchantName},\n\nHeres your monthly summary report:\n- Total Orders: ${reportData.totalOrders}\n- Rescued Orders: ${reportData.rescuedOrders}\n- Rescue Rate: ${reportData.rescueRate}%\n- Revenue Saved: ₹${reportData.totalRevenueSaved}\n\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>📊 Monthly Performance Summary</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>Here is your performance summary for the past month:</p>
      <ul>
        <li><strong>Total Orders:</strong> ${reportData.totalOrders}</li>
        <li><strong>Rescued Orders:</strong> ${reportData.rescuedOrders}</li>
        <li><strong>Rescue Rate:</strong> ${reportData.rescueRate}%</li>
        <li><strong>Revenue Saved:</strong> ₹${reportData.totalRevenueSaved}</li>
      </ul>
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  public async sendMonthlySummary(email: string, merchantName: string, reportData: any, plan?: string): Promise<boolean> {
    return this.sendMonthlySummaryReport(email, merchantName, reportData, plan);
  }

  /**
   * Send payment confirmation alert.
   */
  public async sendPaymentConfirmation(email: string, merchantName: string, amount: number, creditsAdded: number, transactionId: string): Promise<boolean> {
    const subject = `✅ Payment Confirmation - Credits Top-up for ${merchantName}`;
    const text = `Hello ${merchantName},\n\nWe have received your payment of ₹${amount}. ${creditsAdded} credits have been added to your account.\nTransaction ID: ${transactionId}\n\nThank you for choosing RescueShip!\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>✅ Payment Received</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>We have successfully processed your payment of <strong>₹${amount}</strong>.</p>
      <p><strong>${creditsAdded} credits</strong> have been added to your account balance.</p>
      <p>Transaction ID: <code>${esc(transactionId)}</code></p>
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send order limit warnings.
   */
  public async sendOrderLimitWarning(email: string, merchantName: string, currentUsage: number, planLimit: number): Promise<boolean> {
    const subject = `⚠️ Warning: Approaching Plan Order Limit for ${merchantName}`;
    const text = `Hello ${merchantName},\n\nYou have used ${currentUsage} of your ${planLimit} monthly plan orders. Consider upgrading your plan to keep scaling seamlessly.\n\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>⚠️ Plan Order Limit Warning</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>You have processed <strong>${currentUsage}</strong> out of <strong>${planLimit}</strong> orders allowed on your current plan.</p>
      <p>To ensure seamless order processing without interruptions, please consider upgrading your subscription plan.</p>
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Plan activated — congratulate the merchant and offer a free guided setup call.
   * Sent exactly once per first activation (callers gate on prior activatedAt).
   */
  public async sendPlanActivated(email: string, merchantName: string, plan: string): Promise<boolean> {
    const setupCallUrl = process.env.SETUP_CALL_URL || '';
    const appUrl = process.env.APP_URL || 'https://app.rescueship.io';
    const subject = `🚀 Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan is live — RescueShip`;
    const callBlockText = setupCallUrl ? `\n\nWant us to walk you through setup? Book your free onboarding call: ${setupCallUrl}` : '';
    const callBlockHtml = setupCallUrl
      ? `<p style="margin: 20px 0;"><a href="${setupCallUrl}" style="background-color: #059669; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Book your free setup call</a></p>`
      : '';
    const text = `Hello ${merchantName},\n\nYour RescueShip ${plan} plan is now active! Your rescue engine can go live as soon as your connections are verified.\n\nNext steps:\n1. Finish connecting your store, WhatsApp, carrier and payment gateway: ${appUrl}/onboarding\n2. Run the sandbox test rescues, then graduate to live mode.${callBlockText}\n\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.5;">
      <h2>🚀 Your plan is live!</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>Your RescueShip <strong>${esc(plan)}</strong> plan is now active. Your rescue engine can go live as soon as your connections are verified.</p>
      <ol>
        <li>Finish connecting your store, WhatsApp, carrier and payment gateway: <a href="${appUrl}/onboarding">Open onboarding</a></li>
        <li>Run the sandbox test rescues, then graduate to live mode.</li>
      </ol>
      ${callBlockHtml}
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * PLG magic-link onboarding email — first touch after landing-page signup.
   * Explains the product and carries the one-click onboarding link.
   */
  public async sendManifestConfirmationEmail(
    email: string,
    storeUrl: string | undefined,
    onboardingUrl: string,
    merchantName: string = 'Merchant'
  ): Promise<boolean> {
    const setupCallUrl = process.env.SETUP_CALL_URL || '';
    const store = storeUrl || 'your store';
    const subject = `⚓ We received your RescueShip request for ${store} — We'll contact you within 24-48 hours`;
    const text = `Hello ${merchantName},\n\nThank you for requesting to integrate RescueShip for ${store}!\n\nWe have received your request. Our onboarding team is reviewing your details and someone will reach out to you within 24 to 48 hours to help you connect your store, configure your WhatsApp NDR rescue engine, and guide you through setup.\n\nIf you prefer to start connecting your accounts right away, you can use your self-serve onboarding link (valid for 7 days):\n${onboardingUrl}\n${setupCallUrl ? `\nPrefer to pick a specific time for a call? Book your free 20-minute setup call here: ${setupCallUrl}\n` : ''}\nBest regards,\nRescueShip Team`;
    const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 580px; color: #1e293b; padding: 20px;">
      <h2 style="color: #0f172a; margin-top: 0;">⚓ We've received your RescueShip integration request!</h2>
      <p>Hello <strong>${esc(merchantName)}</strong>,</p>
      <p>Thank you for requesting to integrate RescueShip for <strong>${esc(store)}</strong>.</p>
      <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #15803d; font-size: 15px;">⏳ What happens next:</strong>
        <p style="margin: 6px 0 0 0; color: #166534; font-size: 14px;">Our onboarding team is reviewing your store details. <strong>Someone will contact you within 24 to 48 hours</strong> to help connect your store, set up your WhatsApp numbers, and configure automated NDR rescue.</p>
      </div>
      <p>If you would like to start connecting your store, WhatsApp Business, courier and payment gateway right now, you can open your self-serve portal:</p>
      <p style="margin: 24px 0;">
        <a href="${onboardingUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Open Setup Portal</a>
      </p>
      ${setupCallUrl ? `<p style="font-size: 14px; color: #475569;">Prefer to schedule a direct screen-share call? <a href="${setupCallUrl}" style="color: #2563eb; text-decoration: underline;">Book a free 20-minute onboarding call</a>.</p>` : ''}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">RescueShip Team · Autonomous NDR Recovery for D2C Brands</p>
    </div>`;

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Alert the operator that a new lead requested onboarding (PLG signup).
   * Delivered to OWNER_NOTIFY_EMAIL; falls back to a log line when unset.
   */
  public async sendSetupCallAdminNotification(
    email: string,
    storeUrl: string | undefined,
    onboardingUrl: string
  ): Promise<void> {
    await this.notifyOwner('New signup — setup assisted onboarding', {
      email,
      storeUrl: storeUrl || 'not provided',
      onboardingUrl,
      note: 'User completed the landing-page signup. Reach out for their setup call if needed.',
    });
  }

  /**
   * Internal notification to the RescueShip operator (you).
   * Routed to OWNER_NOTIFY_EMAIL; silently no-ops if unset.
   * Never throws — notifications must never break user-facing flows.
   */
  public async notifyOwner(subject: string, details: Record<string, string | number | undefined>): Promise<void> {
    const ownerEmail = process.env.OWNER_NOTIFY_EMAIL;
    if (!ownerEmail) return;

    const rows = Object.entries(details)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(v)}</li>`)
      .join('\n');
    const lines = Object.entries(details)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    try {
      await this.sendEmail({
        to: ownerEmail,
        subject: `[RescueShip Ops] ${subject}`,
        text: `${subject}\n\n${lines}`,
        html: `<div style="font-family: sans-serif; line-height: 1.5;">
          <h2>${esc(subject)}</h2>
          <ul>${rows}</ul>
          <hr />
          <p style="font-size: 12px; color: #666;">RescueShip internal notification</p>
        </div>`,
      });
    } catch (err: any) {
      logger.error('Failed to send owner notification', { subject, error: err.message });
    }
  }
}

export const emailService = EmailService.getInstance();
