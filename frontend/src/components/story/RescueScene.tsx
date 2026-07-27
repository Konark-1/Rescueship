import { useState, useRef, useEffect } from 'react';
import { motion, MotionValue, useTransform } from 'motion/react';
import { usePhase } from './ScrollStory';

export default function RescueScene({ progress }: { progress: MotionValue<number> }) {
  const [step, setStep] = useState(0);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const reset = () => setStep(0);

  const titleP = usePhase(progress, 0, 0.1);
  const timerP = usePhase(progress, 0.05, 0.18);
  const timerOpacity = useTransform(timerP, [0, 1], [0, 1]);
  // Plain integer seconds — can never produce a malformed "0:90"
  const secs = useTransform(timerP, [0, 1], [90, 0]);
  const secsLabel = useTransform(secs, (v) => `${Math.round(v)}s`);

  const chatP = usePhase(progress, 0.15, 0.3);
  const chatOpacity = useTransform(chatP, [0, 1], [0, 1]);
  const chatY = useTransform(chatP, [0, 1], [40, 0]);
  const fadeOut = useTransform(progress, [0.9, 1], [1, 0]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [step]);

  const showReset = step > 0 && step !== 4;

  return (
    <motion.div className="scene scene--rescue" style={{ opacity: fadeOut }}>
      <div className="rescue-layout">
        <motion.div className="rescue-title" style={{ opacity: titleP }}>
          <p className="scene-label scene-label--indigo">RescueShip Engine • Activated</p>
          <h2><em className="serif">90 seconds</em> later,<br />your customer gets this:</h2>
        </motion.div>

        {/* Intercept window — now explained, not a bare ticking clock */}
        <motion.div className="intercept" style={{ opacity: timerOpacity }}>
          <div className="intercept__top">
            <span className="intercept__chip"><motion.span>{secsLabel}</motion.span></span>
            <div className="intercept__copy">
              <strong>⚡ The intercept window</strong>
              <p>Once a courier logs an NDR, most systems wait hours — the order hardens into an RTO and the loss becomes permanent. RescueShip fires this WhatsApp rescue inside the first 90 seconds, before the remark locks.</p>
            </div>
          </div>
        </motion.div>

        <motion.div className="rescue-phone-wrap" style={{ opacity: chatOpacity, y: chatY }}>
          <div className="wa-phone">
            <div className="wa-phone__hdr">
              <div className="wa-phone__avatar">RS</div>
              <div className="wa-phone__hdr-id"><strong>RescueBot</strong><span className="wa-phone__online">online</span></div>
              {/* Refresh / reset button */}
              <button className="rescue-reset" onClick={reset} title="Reset conversation" aria-label="Reset conversation">↻</button>
            </div>
            <div className="wa-phone__body" ref={chatBodyRef}>
              <div className="wa-msg wa-msg--bot">
                Hi Priya! 👋 We flagged a suspicious delivery remark on Order #89421. Our rider marked "Door Locked" but no delivery attempt was recorded.
                <br /><br />What would you like to do?
              </div>

              {step === 0 && (
                <motion.div className="wa-actions" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <button className="wa-btn wa-btn--yes" onClick={() => setStep(1)}>✅ Yes, I'm home! Redeliver</button>
                  <button className="wa-btn" onClick={() => setStep(2)}>📅 Reschedule for tomorrow</button>
                  <button className="wa-btn" onClick={() => setStep(3)}>📍 Share my location pin</button>
                  <button className="wa-btn wa-btn--cancel" onClick={() => setStep(4)}>❌ Cancel this order</button>
                </motion.div>
              )}

              {step === 1 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>Yes I'm home! Nobody came! 😤</motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>⚡ Fake remark escalated to Delhivery hub supervisor</motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>Confirmed! Priority re-attempt scheduled for tomorrow 9 AM – 12 PM with supervisor tracking. 🚚</motion.div>
                </>
              )}

              {step === 2 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>Reschedule for tomorrow please</motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>⚡ Carrier synced: Re-attempt tomorrow 10 AM – 2 PM</motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>Done! We've rescheduled your delivery. You'll get a reminder 1 hour before. 📅</motion.div>
                </>
              )}

              {step === 3 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>📍 Location: 19.1197°N, 72.8464°E</motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>📍 Reverse-geocoded → "B-402, Sunrise Apartments, Andheri West"</motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>🛵 Coordinates pushed to driver navigation app</motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>Got your exact location! Pushed to the driver's GPS. They'll find B-402 this time. 🎯</motion.div>
                </>
              )}

              {step === 4 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>I don't want this anymore. Cancel it.</motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>We're sorry to see you go, Priya. 😔 Before we cancel — would a <strong>₹100 discount</strong> change your mind?</motion.div>
                  <motion.div className="wa-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                    <button className="wa-btn wa-btn--yes" onClick={() => setStep(5)}>💰 Yes! Apply ₹100 OFF</button>
                    <button className="wa-btn wa-btn--cancel" onClick={() => setStep(6)}>No, cancel the order</button>
                  </motion.div>
                </>
              )}

              {step === 5 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>Okay fine, apply the discount 😅</motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>✅ ₹100 discount applied • New total: ₹1,324</motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>🔄 Order #89421 reactivated • Priority delivery scheduled</motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>Awesome! Your order is back on track with ₹100 OFF, delivering tomorrow 9 AM – 12 PM. Thanks for the second chance! 🙏</motion.div>
                </>
              )}

              {step === 6 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>No thanks. Just cancel it.</motion.div>
                  <motion.div className="wa-msg wa-msg--sys wa-msg--sys--cancel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>❌ Order #89421 cancelled • RTO initiated • Refund queued (if prepaid)</motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>Understood — your order is cancelled. Here's a <strong>₹150 coupon</strong> for next time: <strong>COMEBACK150</strong>. We'd love to serve you better. 💛</motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>📊 Merchant notified • RTO loss logged • Coupon COMEBACK150 issued</motion.div>
                </>
              )}
            </div>
          </div>

          {step === 0 && (
            <motion.p className="rescue-hint" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>👆 Tap a button — this is what your customer sees</motion.p>
          )}
          {showReset && (
            <motion.button className="rescue-reset-btn" onClick={reset} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>↻ Reset conversation & try another response</motion.button>
          )}
          {showReset && step !== 5 && step !== 6 && (
            <motion.p className="rescue-hint rescue-hint--done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>✅ Order #89421 rescued. ₹430 saved. Priya stays your customer.</motion.p>
          )}
          {step === 5 && (
            <motion.p className="rescue-hint rescue-hint--done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>✅ Cancellation averted — the ₹100 retention offer cost less than the ₹430 RTO loss.</motion.p>
          )}
          {step === 6 && (
            <motion.p className="rescue-hint rescue-hint--cancel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>❌ Order cancelled — but the comeback coupon protects the customer-acquisition spend.</motion.p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
