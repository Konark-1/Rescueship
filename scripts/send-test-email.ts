import 'dotenv/config';
import { emailService } from '../src/services/email.service';

async function main() {
  console.log('--- Email Service Status ---');
  console.log(emailService.getStatus());

  console.log('\n--- Verifying Transport Connection ---');
  const verify = await emailService.verifyConnection();
  console.log('Connection Verification:', verify);

  console.log('\n--- Sending Test Email to konarkofficial@gmail.com ---');
  const success = await emailService.sendEmail({
    to: 'konarkofficial@gmail.com',
    subject: '🧪 RescueShip Notification Test - Verified Delivery',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0b0f19; color: #f1f5f9; border-radius: 12px; border: 1px solid #1e293b;">
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 24px;">🚢 RescueShip Notification System</h2>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">
          Hi Konark,
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">
          This test email confirms that your <strong>RescueShip Email Notification Pipeline</strong> is fully operational and delivering to <strong>konarkofficial@gmail.com</strong>.
        </p>
        
        <div style="background: #131b2e; border: 1px solid #1e293b; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <h4 style="margin: 0 0 12px 0; color: #10b981; font-size: 16px;">Active Live Notifications:</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #94a3b8;">
            <li><strong style="color: #f1f5f9;">Merchant Onboarding Alerts:</strong> Instant email to <em>konarkofficial@gmail.com</em> when any retailer registers or requests integration.</li>
            <li><strong style="color: #f1f5f9;">Weekly Sunday ROI Reports:</strong> Automated breakdown of RTO fees saved and money recovered.</li>
            <li><strong style="color: #f1f5f9;">Low Credit Warnings:</strong> Triggered automatically when merchant rescue credits drop to &le; 10.</li>
            <li><strong style="color: #f1f5f9;">Auth & Security Alerts:</strong> Password resets and emergency tenant circuit breaker trip warnings.</li>
          </ul>
        </div>

        <p style="font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px;">
          Dispatched at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST<br/>
          Server Origin: RescueShip Production &bull; konarkofficial@gmail.com
        </p>
      </div>
    `,
  });

  console.log(`\nEmail send result: ${success ? '✅ SUCCESS - Email dispatched to konarkofficial@gmail.com' : '❌ FAILED'}`);
}

main().catch(console.error);
