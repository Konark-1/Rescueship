import { motion } from 'motion/react';
const P = ['Shopify','WooCommerce','Delhivery','Shiprocket','BlueDart','Razorpay','Cashfree','India Post'];
export default function MarqueeLogos() {
  const d = [...P, ...P];
  return (
    <div className="marquee-wrap">
      <motion.div className="marquee-track" animate={{ x: ['0%','-50%'] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}>
        {d.map((n, i) => <span key={i} className="marquee-item">{n}</span>)}
      </motion.div>
    </div>
  );
}
