import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Slide {
  image: string;
  title: string;
  subtitle: string;
  badge?: string;
}

interface HeroSliderProps {
  slides: Slide[];
  autoplayInterval?: number;
  children?: React.ReactNode;
}

export default function HeroSlider({ slides, autoplayInterval = 5000, children }: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = useCallback((index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  }, [current]);

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((p) => (p + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((p) => (p - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const timer = setInterval(next, autoplayInterval);
    return () => clearInterval(timer);
  }, [next, autoplayInterval]);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <div className="relative w-full h-[50vh] md:h-[65vh] overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0"
        >
          <img
            src={slides[current].image}
            alt={slides[current].title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="absolute inset-0 z-10 flex items-center">
        <div className="container">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="max-w-2xl"
            >
              {slides[current].badge && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-background/20 backdrop-blur-sm px-4 py-1.5 text-sm text-background">
                  {slides[current].badge}
                </div>
              )}
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-background leading-tight">
                {slides[current].title}
              </h1>
              <p className="mt-4 text-base md:text-lg text-background/80 max-w-lg">
                {slides[current].subtitle}
              </p>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Arrows */}
      <div className="absolute inset-y-0 left-3 z-20 flex items-center">
        <button onClick={prev}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-background/20 backdrop-blur-sm text-background hover:bg-background/30 transition-colors"
          aria-label="Previous slide">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-3 z-20 flex items-center">
        <button onClick={next}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-background/20 backdrop-blur-sm text-background hover:bg-background/30 transition-colors"
          aria-label="Next slide">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-background" : "w-2 bg-background/40 hover:bg-background/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Progress */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-background/10">
        <motion.div
          key={current}
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: autoplayInterval / 1000, ease: "linear" }}
        />
      </div>
    </div>
  );
}
