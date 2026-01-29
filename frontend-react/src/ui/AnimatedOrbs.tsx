import { motion } from 'framer-motion';

export default function AnimatedOrbs() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -top-24 -left-24 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(139,92,246,0.35), transparent 60%)' }}
        animate={{ x: [0, 20, -10, 0], y: [0, -10, 10, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle at 70% 70%, rgba(34,211,238,0.30), transparent 60%)' }}
        animate={{ x: [0, -15, 10, 0], y: [0, 15, -10, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.25), transparent 60%)' }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

