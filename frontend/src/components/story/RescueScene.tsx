import { useState } from 'react';
import { motion } from 'motion/react';

export default function RescueScene() {
  const [step, setStep] = useState(0);

  return (
    <section className="lp-rescue-section">
      <div className="container rescue-layout">
        {/* Title */}
        <motion.div
          className="rescue-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="scene-label scene-label--indigo">RescueShip Engine • Activated</p>
          <h2>
            <em className="serif">90 seconds</em> later,
            <br />
            your customer gets this:
          </h2>
        </motion.div>

        {/* Timer Badge */}
        <motion.div
          className="rescue-timer"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span className="rescue-timer__val">0:90</span>
          <span className="rescue-timer__label">intercept window</span>
        </motion.div>

        {/* WhatsApp Phone Interactive Component */}
        <motion.div
          className="rescue-phone-wrap"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <div className="wa-phone">
            <div className="wa-phone__hdr">
              <div className="wa-phone__avatar">RS</div>
              <div>
                <strong>RescueBot</strong>
                <span className="wa-phone__online">online</span>
              </div>
            </div>
            <div className="wa-phone__body">
              {/* Initial Bot message */}
              <div className="wa-msg wa-msg--bot">
                Hi Priya! 👋 We flagged a suspicious delivery remark on Order #89421.
                Our rider marked "Door Locked" but GPS shows he never left the warehouse.
                <br /><br />Were you available at home?
              </div>

              {/* Step 0: Interactive Buttons */}
              {step === 0 && (
                <motion.div
                  className="wa-actions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <button className="wa-btn wa-btn--yes" onClick={() => setStep(1)}>
                    ✅ Yes, I'm home!
                  </button>
                  <button className="wa-btn" onClick={() => setStep(2)}>
                    📅 Reschedule
                  </button>
                  <button className="wa-btn" onClick={() => setStep(3)}>
                    📍 Share my location
                  </button>
                </motion.div>
              )}

              {/* Step 1: Yes I'm home response */}
              {step >= 1 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }}>
                    Yes I'm home! Nobody came! 😤
                  </motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    ⚡ Fake remark escalated to Delhivery hub supervisor
                  </motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                    Confirmed! Priority re-attempt scheduled for tomorrow 9AM–12PM with supervisor GPS tracking. 🚚
                  </motion.div>
                </>
              )}

              {/* Step 2: Reschedule response */}
              {step === 2 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }}>
                    Reschedule for tomorrow please
                  </motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    ⚡ Carrier synced: Re-attempt tomorrow 10AM–2PM
                  </motion.div>
                </>
              )}

              {/* Step 3: Location response */}
              {step === 3 && (
                <>
                  <motion.div className="wa-msg wa-msg--user" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }}>
                    📍 Location: 19.1197°N, 72.8464°E
                  </motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                    📍 GPS pin reverse-geocoded → "B-402, Sunrise Apartments, Andheri West"
                  </motion.div>
                  <motion.div className="wa-msg wa-msg--sys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                    🛵 Coordinates pushed to driver navigation app
                  </motion.div>
                  <motion.div className="wa-msg wa-msg--bot" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                    Got your exact location! Pushed to the driver's GPS. They'll find B-402 this time. 🎯
                  </motion.div>
                </>
              )}
            </div>
          </div>

          {/* Helper hint below phone */}
          {step === 0 ? (
            <p className="rescue-hint">👆 Tap a button — this is what your customer sees</p>
          ) : (
            <p className="rescue-hint rescue-hint--done">
              ✅ Order #89421 rescued. ₹430 saved. Priya stays your customer.
              <button className="rescue-reset-btn" onClick={() => setStep(0)}>Try again ↺</button>
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
