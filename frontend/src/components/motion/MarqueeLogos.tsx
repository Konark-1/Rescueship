/**
 * MarqueeLogos — Infinite horizontal scroll of partner logos.
 * Pure CSS animation, zero JS overhead.
 */
import { motion } from 'motion/react';

const PARTNERS = [
  'Shopify', 'WooCommerce', 'Delhivery', 'Shiprocket',
  'BlueDart', 'Razorpay', 'Cashfree', 'India Post',
];

export default function MarqueeLogos() {
  const doubled = [...PARTNERS, ...PARTNERS];

  return (
    <div className="marquee-wrapper">
      <motion.div
        className="marquee-track"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {doubled.map((name, i) => (
          <span key={i} className="marquee-item">
            {name}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
