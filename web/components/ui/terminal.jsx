"use client";
import {
  Children,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { motion, useInView } from "framer-motion";

import { cn } from "@/lib/utils"

const SequenceContext = createContext(null)

const useSequence = () => useContext(SequenceContext)

const ItemIndexContext = createContext(null)
const useItemIndex = () => useContext(ItemIndexContext)

export const AnimatedSpan = ({
  children,
  delay = 0,
  className,
  startOnView = false,
  ...props
}) => {
  const elementRef = useRef(null)
  const isInView = useInView(elementRef, {
    amount: 0.3,
    once: true,
  })

  const sequence = useSequence()
  const itemIndex = useItemIndex()
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    if (!sequence || itemIndex === null) return
    if (!sequence.sequenceStarted) return
    if (hasStarted) return
    if (sequence.activeIndex === itemIndex) {
      setHasStarted(true)
    }
  }, [sequence?.activeIndex, sequence?.sequenceStarted, hasStarted, itemIndex])

  const shouldAnimate = sequence ? hasStarted : startOnView ? isInView : true

  return (
    <motion.div
      ref={elementRef}
      initial={{ opacity: 0, y: -5 }}
      animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: -5 }}
      transition={{ duration: 0.3, delay: sequence ? 0 : delay / 1000 }}
      className={cn("block text-sm font-normal tracking-tight", className)}
      onAnimationComplete={() => {
        if (!sequence) return
        if (itemIndex === null) return
        sequence.completeItem(itemIndex)
      }}
      {...props}>
      {children}
    </motion.div>
  );
}

export const TypingAnimation = ({
  children,
  className,
  duration = 60,
  delay = 0,
  as: Component = "span",
  startOnView = true,
  ...props
}) => {
  if (typeof children !== "string") {
    throw new Error("TypingAnimation: children must be a string. Received:")
  }

  const MotionComponent = useMemo(() =>
    motion.create(Component, {
      forwardMotionProps: true,
    }), [Component])

  const [displayedText, setDisplayedText] = useState("")
  const [started, setStarted] = useState(false)
  const elementRef = useRef(null)
  const isInView = useInView(elementRef, {
    amount: 0.3,
    once: true,
  })

  const sequence = useSequence()
  const itemIndex = useItemIndex()

  useEffect(() => {
    if (sequence && itemIndex !== null) {
      if (!sequence.sequenceStarted) return
      if (started) return
      if (sequence.activeIndex === itemIndex) {
        setStarted(true)
      }
      return
    }

    if (!startOnView) {
      const startTimeout = setTimeout(() => setStarted(true), delay)
      return () => clearTimeout(startTimeout);
    }

    if (!isInView) return

    const startTimeout = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(startTimeout);
  }, [
    delay,
    startOnView,
    isInView,
    started,
    sequence?.activeIndex,
    sequence?.sequenceStarted,
    itemIndex,
  ])

  useEffect(() => {
    if (!started) return

    let i = 0
    const typingEffect = setInterval(() => {
      if (i < children.length) {
        setDisplayedText(children.substring(0, i + 1))
        i++
      } else {
        clearInterval(typingEffect)
        if (sequence && itemIndex !== null) {
          sequence.completeItem(itemIndex)
        }
      }
    }, duration)

    return () => {
      clearInterval(typingEffect)
    };
  }, [children, duration, started])

  return (
    <MotionComponent
      ref={elementRef}
      className={cn("text-sm font-normal tracking-tight block", className)}
      {...props}>
      {displayedText}
      {started && displayedText.length < children.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block ml-1"
        >
          |
        </motion.span>
      )}
    </MotionComponent>
  );
}

export const Terminal = ({
  children,
  className,
  sequence = true,
  startOnView = true,
  height = "400px" // Allow customizable height
}) => {
  const containerRef = useRef(null)
  const scrollRef = useRef(null)
  const isInView = useInView(containerRef, {
    amount: 0.3,
    once: true,
  })

  const [activeIndex, setActiveIndex] = useState(0)
  const sequenceHasStarted = sequence ? !startOnView || isInView : false

  // Auto-scroll to bottom when new content is added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [children, activeIndex])

  const contextValue = useMemo(() => {
    if (!sequence) return null
    return {
      completeItem: (index) => {
        setActiveIndex((current) => (index === current ? current + 1 : current))
      },
      activeIndex,
      sequenceStarted: sequenceHasStarted,
    };
  }, [sequence, activeIndex, sequenceHasStarted])

  const wrappedChildren = useMemo(() => {
    if (!sequence) return children
    const array = Children.toArray(children)
    return array.map((child, index) => (
      <ItemIndexContext.Provider key={index} value={index}>
        {child}
      </ItemIndexContext.Provider>
    ));
  }, [children, sequence])

  const content = (
    <div
      ref={containerRef}
      className={cn(
        "border-white/20 bg-black/90 backdrop-blur-sm z-0 w-full rounded-xl border shadow-2xl",
        className
      )}
      style={{ height }}>
      {/* Terminal Header */}
      <div className="flex flex-col gap-y-2 border-b p-4">
        <div className="flex flex-row gap-x-2">
          <div className="h-3 w-3 rounded-full bg-red-500 shadow-sm"></div>
          <div className="h-3 w-3 rounded-full bg-yellow-500 shadow-sm"></div>
          <div className="h-3 w-3 rounded-full bg-green-500 shadow-sm"></div>
        </div>
      </div>

      {/* Scrollable Terminal Content */}
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden h-full p-4 font-mono text-sm leading-relaxed"
        style={{
          maxHeight: `calc(${height} - 60px)`, // Subtract header height
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent'
        }}
      >
        <div className="space-y-1 min-h-full">
          {wrappedChildren}
        </div>
      </div>
    </div>
  )

  if (!sequence) return content

  return (
    <SequenceContext.Provider value={contextValue}>
      {content}
    </SequenceContext.Provider>
  );
}
