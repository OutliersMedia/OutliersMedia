import { motion, useReducedMotion } from 'framer-motion';

export default function FadeSection({ children, className, id, style }) {
  const shouldReduceMotion = useReducedMotion();
  
  const variants = {
    hidden: { 
      opacity: 0, 
      scale: 0.9, 
      y: 80 
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 20,
        mass: 1
      }
    }
  };

  return (
    <motion.section
      id={id}
      style={style}
      initial={shouldReduceMotion ? "visible" : "hidden"}
      animate="visible"
      variants={variants}
      className={`will-change-transform will-change-opacity origin-bottom ${className}`}
    >
      {children}
    </motion.section>
  );
}
