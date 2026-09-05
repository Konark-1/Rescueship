import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private isSmtpConfigured: boolean = false;

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
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.isSmtpConfigured = true;
      logger.info('EmailService initialized with SMTP transport', { host, port, user });
    } else {
      this.isSmtpConfigured = false;
      logger.info('EmailService initialized with fallback logging (SMTP credentials not fully provided)');
    }
  }

  /**
   * Send email using SMTP transporter or fallback to logging.
   */
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    const from = process.env.SMTP_FROM || 'noreply@rescueship.io';

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
    } else {
      this.logEmailFallback(from, options);
      return true;
    }
  }

  private logEmailFallback(from: string, options: EmailOptions): void {
    logger.info('[Email Fallback Log]', {
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
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
      <p>Hello <strong>${merchantName}</strong>,</p>
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
      <p>Hello <strong>${merchantName}</strong>,</p>
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
      <p>Hello <strong>${merchantName}</strong>,</p>
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
      <p>Hello <strong>${merchantName}</strong>,</p>
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
      <p>Hello <strong>${merchantName}</strong>,</p>
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
      <p>Hello <strong>${merchantName}</strong>,</p>
      <p>We have successfully processed your payment of <strong>₹${amount}</strong>.</p>
      <p><strong>${creditsAdded} credits</strong> have been added to your account balance.</p>
      <p>Transaction ID: <code>${transactionId}</code></p>
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
      <p>Hello <strong>${merchantName}</strong>,</p>
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
      <p>Hello <strong>${merchantName}</strong>,</p>
      <p>Your RescueShip <strong>${plan}</strong> plan is now active. Your rescue engine can go live as soon as your connections are verified.</p>
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
    const subject = `⚓ Welcome aboard, ${merchantName} — your rescue engine is being provisioned`;
    const text = `Hello ${merchantName},\n\nThanks for signing up RescueShip for ${store}. Here's what happens next:\n\n1. Open your personal onboarding link (valid 7 days):\n${onboardingUrl}\n\n2. Connect your store, WhatsApp Business, courier account and payment gateway — each takes ~2 minutes and is validated live.\n\n3. Run the sandbox test rescues, graduate, and go live. From then on every failed delivery (NDR) and COD order is rescued automatically on WhatsApp.\n${setupCallUrl ? `\nPrefer a guided setup? Book a free 20-minute call and we'll set everything up with you: ${setupCallUrl}\n` : ''}\n— RescueShip Team`;
    const html = `<div style="font-family: sans-serif; line-height: 1.6; max-width: 560px;">
      <h2>⚓ Welcome aboard, ${merchantName}!</h2>
      <p>Thanks for signing up RescueShip for <strong>${store}</strong>. RescueShip automatically converts COD orders to prepaid and rescues failed deliveries (NDRs) over WhatsApp — recovering the revenue most D2C brands lose to RTO.</p>
      <p><strong>Your next 3 steps:</strong></p>
      <ol>
        <li>Open your personal onboarding link (valid 7 days):<br />
          <a href="${onboardingUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 8px 0;">Start onboarding</a></li>
        <li>Connect your store, WhatsApp Business, courier and payment gateway — each validated live in ~2 minutes.</li>
        <li>Run sandbox test rescues, graduate, and go live.</li>
      </ol>
      ${setupCallUrl ? `<p>Prefer a guided setup? <a href="${setupCallUrl}" style="background-color: #059669; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Book your free setup call</a> — we'll configure everything with you inside your own portal.</p>` : ''}
      <hr />
      <p style="font-size: 12px; color: #666;">RescueShip Team</p>
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
      .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
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
          <h2>${subject}</h2>
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
