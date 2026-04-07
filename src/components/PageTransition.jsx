import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export default function PageTransition({ children }) {
  // Disable animations on Android for better performance
  const isAndroid = /android/i.test(navigator.userAgent);
  const animationDuration = isAndroid ? 0 : 0.18;

  return (
    <motion.div
      variants={isAndroid ? {} : variants}
      initial={isAndroid ? undefined : "initial"}
      animate={isAndroid ? undefined : "animate"}
      exit={isAndroid ? undefined : "exit"}
      transition={{ duration: animationDuration, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}