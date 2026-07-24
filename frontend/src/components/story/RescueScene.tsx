/**
 * RescueScene — "90 Seconds Later."
 * Interactive WhatsApp playground. User TAPS buttons.
 * GPS pin drops. Driver gets coordinates. Order rescued.
 */
import { useState } from 'react';
import { motion, MotionValue, useTransform } from 'motion/react';
import { usePhase } from './ScrollStory';

export default function RescueScene({ progress }: { progress: MotionValue<number> }) {
  const [step, setStep] = useState(0);

  const titleP = usePhase(progress, 0, 0.1);
  const timerP = usePhase(progress, 0.05, 0.18);
  const timerOpacity = useTransform(timerP, [0, 1], [0, 1]);
  const secs = useTransform(timerP, [0, 1], [90, 0]);
  const secsDisplay = useTransform(secs, v => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`);

  const chatP = usePhase(progress, 0.15, 0.3);
  const chatOpacity = useTransform(chatP, [0, 1], [0, 1]);
  const chatY = useTransform(chatP, [0, 1], [40, 0]);

  const fadeOut = useTransform(progress, [0.9, 1], [1, 0]);

  return (
    <motion.div className="scene scene--rescue" style={{ opacity: fadeOut }}>
      <motion.div className="rescue-title" style={{ opacity: titleP }}>
        <p className="scene-label scene-label--indigo">RescueShip Engine • Activated</p>
        <h2>
          <em className="serif">90 seconds</em> later,
          <br />
          your customer gets this:
        </h2>
      </motion.div>

      {/* Timer */}
      <motion.div className="rescue-timer" style={{ opacity: timerOpacity }}>
        <motion.span className="rescue-timer__val">{secsDisplay}</motion.span>
        <span className="rescue-timer__label">intercept window</span>
      </motion.div>

      {/* WhatsApp phone */}
      <motion.div className="rescue-phone-wrap" style={{ opacity: chatOpacity, y: chatY }}>
        <div className="wa-phone">
          <div className="wa-phone__hdr">
            <div className="wa-phone__avatar">RS</div>
            <div><strong>RescueBot</strong><span className="wa-phone__online">online</span></div>
          </div>
          <div className="wa-phone__body">
            {/* Bot message */}
            <div className="wa-msg wa-msg--bot">
              Hi Priya! 👋 We flagged a suspicious delivery remark on Order #89421.
              Our rider marked "Door Locked" but GPS shows he never left the warehouse.
              <br /><br />Were you available at home?
            </div>

            {/* Step 0: Buttons */}
            {step === 0 && (
              <motion.div className="wa-actions" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <button className="wa-btn wa-btn--yes" onClick={() => setStep(1)}>✅ Yes, I'm home!</button>
                <button className="wa-btn" onClick={() => setStep(2)}>📅 Reschedule</button>
                <button className="wa-btn" onClick={() => setStep(3)}>📍 Share my location</button>
              </motion.div>
            )}

            {/* Step 1: Yes I'm home */}
            {step >= 1 && (
              <>
                <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  Yes I'm home! Nobody came! 😤
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  ⚡ Fake remark escalated to Delhivery hub supervisor
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                  Confirmed! Priority re-attempt scheduled for tomorrow 9AM–12PM with supervisor GPS tracking. 🚚
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
                  ⚡ Carrier synced: Re-attempt tomorrow 10AM–2PM
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
                  📍 GPS pin reverse-geocoded → "B-402, Sunrise Apartments, Andheri West"
                </motion.div>
                <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  🛵 Coordinates pushed to driver navigation app
                </motion.div>
                <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
                  Got your exact location! Pushed to the driver's GPS. They'll find B-402 this time. 🎯
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Tap hint */}
        {step === 0 && (
          <motion.p className="rescue-hint" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
            👆 Tap a button — this is what your customer sees
          </motion.p>
        )}
        {step > 0 && (
          <motion.p className="rescue-hint rescue-hint--done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ✅ Order #89421 rescued. ₹430 saved. Priya stays your customer.
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}
