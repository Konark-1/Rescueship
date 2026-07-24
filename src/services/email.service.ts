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
}

export const emailService = EmailService.getInstance();
