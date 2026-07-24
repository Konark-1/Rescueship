import { useState } from 'react';
import { motion } from 'motion/react';

export default function RescueScene() {
  const [step, setStep] = useState(0);
  // step 0 = buttons, 1 = yes home, 2 = reschedule, 3 = location, 4 = cancel

  return (
    <motion.div className="scene scene--rescue">
      <div className="rescue-title">
        <p className="scene-label scene-label--indigo">RescueShip Engine • Activated</p>
        <h2><em className="serif">90 seconds</em> later,<br />your customer gets this:</h2>
      </div>

      <div className="rescue-timer">
        <span className="rescue-timer__val">0:90</span>
        <span className="rescue-timer__label">intercept window</span>
      </div>

      <div className="rescue-phone-wrap">
        <div className="wa-phone">
          <div className="wa-phone__hdr">
            <div className="wa-phone__avatar">RS</div>
            <div><strong>RescueBot</strong><span className="wa-phone__online">online</span></div>
          </div>
          <div className="wa-phone__body">
            <div className="wa-msg wa-msg--bot">
              Hi Priya! 👋 We flagged a suspicious delivery remark on Order #89421.
              Our rider marked "Door Locked" but no delivery attempt was recorded.
              <br /><br />What would you like to do?
            </div>

            {/* Step 0: All 4 buttons including Cancel */}
            {step === 0 && (
              <motion.div className="wa-actions" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <button className="wa-btn wa-btn--yes" onClick={() => setStep(1)}>✅ Yes, I'm home! Redeliver</button>
                <button className="wa-btn" onClick={() => setStep(2)}>📅 Reschedule for tomorrow</button>
                <button className="wa-btn" onClick={() => setStep(3)}>📍 Share my location pin</button>
                <button className="wa-btn wa-btn--cancel" onClick={() => setStep(4)}>❌ Cancel this order</button>
              </motion.div>
            )}

            {/* Step 1: Yes I'm home */}
            {step >= 1 && step !== 4 && step !== 5 && step !== 6 && (
              <>
                <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  Yes I'm home! Nobody came! 😤
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  ⚡ Fake remark escalated to Delhivery hub supervisor
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                  Confirmed! Priority re-attempt scheduled for tomorrow 9 AM – 12 PM with supervisor tracking. 🚚
                </motion.div>
              </>
            )}

            {/* Step 2: Reschedule */}
            {step === 2 && (
              <>
                <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  Reschedule for tomorrow please
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  ⚡ Carrier synced: Re-attempt tomorrow 10 AM – 2 PM
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                  Done! We've rescheduled your delivery. You'll get a reminder 1 hour before. 📅
                </motion.div>
              </>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <>
                <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  📍 Location: 19.1197°N, 72.8464°E
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  📍 Reverse-geocoded → "B-402, Sunrise Apartments, Andheri West"
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  🛵 Coordinates pushed to driver navigation app
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
                  Got your exact location! Pushed to the driver's GPS. They'll find B-402 this time. 🎯
                </motion.div>
              </>
            )}

            {/* Step 4: CANCEL — the user actually cancelled */}
            {step === 4 && (
              <>
                <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  I don't want this anymore. Cancel it.
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                  We're sorry to see you go, Priya. 😔 Before we cancel — would a <strong>₹100 discount</strong> change your mind?
                </motion.div>

                {/* Retention offer buttons */}
                <motion.div className="wa-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                  <button className="wa-btn wa-btn--yes" onClick={() => setStep(5)}>💰 Yes! Apply ₹100 OFF</button>
                  <button className="wa-btn wa-btn--cancel" onClick={() => setStep(6)}>No, cancel the order</button>
                </motion.div>
              </>
            )}

            {/* Step 5: Customer accepted retention offer */}
            {step === 5 && (
              <>
                <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  Okay fine, apply the discount 😅
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  ✅ ₹100 discount applied • New total: ₹1,324
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  🔄 Order #89421 reactivated • Priority delivery scheduled
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
                  Awesome! Your order is back on track with ₹100 OFF. Delivering tomorrow 9 AM – 12 PM. Thank you for giving us another chance! 🙏
                </motion.div>
              </>
            )}

            {/* Step 6: Customer confirmed cancellation */}
            {step === 6 && (
              <>
                <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  No thanks. Just cancel it.
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys wa-msg--sys--cancel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  ❌ Order #89421 cancelled • RTO initiated • Refund queued (if prepaid)
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                  Understood. Your order has been cancelled. We're sorry we couldn't make it work this time.
                  <br /><br />
                  Here's a <strong>₹150 coupon</strong> for your next order: <strong>COMEBACK150</strong>
                  <br /><br />
                  We'd love to serve you better next time. 💛
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                  📊 Merchant notified • RTO loss logged • Coupon COMEBACK150 issued
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Hint text */}
        {step === 0 && (
          <motion.p className="rescue-hint" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
            👆 Tap a button — this is what your customer sees
          </motion.p>
        )}
        {step > 0 && step !== 4 && step !== 6 && (
          <motion.p className="rescue-hint rescue-hint--done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ✅ Order #89421 rescued. ₹430 saved. Priya stays your customer.
          </motion.p>
        )}
        {step === 5 && (
          <motion.p className="rescue-hint rescue-hint--done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ✅ Cancel averted! Retention offer worked. ₹100 discount &lt; ₹430 RTO loss.
          </motion.p>
        )}
        {step === 6 && (
          <motion.p className="rescue-hint rescue-hint--cancel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ❌ Order cancelled. But the merchant still saved the CAC with a comeback coupon.
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
