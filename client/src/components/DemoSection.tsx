import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Copy, Check, Linkedin, ArrowRight, Sparkles, MousePointer2, RotateCcw } from "lucide-react";

interface DemoStep {
  number: number;
  title: string;
  description: string;
}

interface Point {
  x: number;
  y: number;
}

// Human-like cursor movement hook
function useHumanCursor(initialPos: Point = { x: 50, y: 50 }) {
  const [position, setPosition] = useState<Point>(initialPos);
  const [isMoving, setIsMoving] = useState(false);
  const animationRef = useRef<number | null>(null);
  const positionRef = useRef<Point>(initialPos); // Track current position in ref to avoid stale closures

  // Keep ref in sync with state
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const moveTo = useCallback((target: Point, onComplete?: () => void) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Use ref for current position to avoid stale closure
    const start = { ...positionRef.current };
    const startTime = performance.now();

    // Randomize duration for natural feel (600-1000ms)
    const duration = 600 + Math.random() * 400;

    // Calculate distance
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Skip animation if already at target
    if (distance < 1) {
      setPosition(target);
      positionRef.current = target;
      onComplete?.();
      return;
    }

    // Calculate control points for bezier curve (adds subtle arc)
    const arcIntensity = Math.min(distance * 0.15, 20); // Reduced arc intensity
    const arcDirection = Math.random() > 0.5 ? 1 : -1;

    // Perpendicular offset for curve (safe division)
    const perpX = (-dy / distance) * arcIntensity * arcDirection;
    const perpY = (dx / distance) * arcIntensity * arcDirection;

    // Control point at ~40% of the path
    const cp1 = {
      x: start.x + dx * 0.4 + perpX,
      y: start.y + dy * 0.4 + perpY
    };

    // Second control point at ~70% for smooth approach
    const cp2 = {
      x: start.x + dx * 0.7 - perpX * 0.2,
      y: start.y + dy * 0.7 - perpY * 0.2
    };

    setIsMoving(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      let progress = Math.min(elapsed / duration, 1);

      // Smooth ease-out curve
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      // Cubic bezier interpolation
      const t = easedProgress;
      const t2 = t * t;
      const t3 = t2 * t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;

      // Calculate position on bezier curve
      const x = mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * target.x;
      const y = mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * target.y;

      const newPos = { x, y };
      setPosition(newPos);
      positionRef.current = newPos;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsMoving(false);
        setPosition(target);
        positionRef.current = target;
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []); // No dependencies - uses ref for current position

  const jumpTo = useCallback((pos: Point) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setPosition(pos);
    positionRef.current = pos;
    setIsMoving(false);
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return { position, isMoving, moveTo, jumpTo };
}

export default function DemoSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [selectedHook, setSelectedHook] = useState(-1);
  const [showPostSuccess, setShowPostSuccess] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  const { position: cursorPos, moveTo: moveCursor, jumpTo: jumpCursor } = useHumanCursor({ x: 180, y: 120 });

  const fullText = "The future of remote work isn't fully remote or in-office—it's hybrid. Our research shows 73% of employees want flexible options...";

  const hooks = [
    "The 9-to-5 office model is dead. Here's what's replacing it...",
    "73% of employees want this. Is your company listening?",
    "I analyzed 3 years of remote work data. The results surprised me.",
  ];

  const steps: DemoStep[] = [
    {
      number: 1,
      title: "Paste your content",
      description: "Drop in any blog post, article, or rough ideas.",
    },
    {
      number: 2,
      title: "Pick your hook",
      description: "We generate 3 scroll-stopping hooks. The first line is everything on LinkedIn.",
    },
    {
      number: 3,
      title: "Post to LinkedIn",
      description: "Copy with one click or post directly to LinkedIn. That's it.",
    },
  ];

  // Reset states when step changes
  useEffect(() => {
    if (activeStep === 0) {
      setTypingText("");
      setSelectedHook(-1);
      setShowPostSuccess(false);
      jumpCursor({ x: 180, y: 120 }); // Center of text area
    } else if (activeStep === 1) {
      setSelectedHook(-1);
      setShowPostSuccess(false);
      // Don't move cursor here - let the hook selection animation handle it
    } else if (activeStep === 2) {
      setShowPostSuccess(false);
      // Don't move cursor here - let the post animation handle it
    }
  }, [activeStep, jumpCursor]);

  // Typing animation for step 1
  useEffect(() => {
    if (activeStep === 0 && isPlaying) {
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex < fullText.length) {
          setTypingText(fullText.slice(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typeInterval);
        }
      }, 40); // Slower typing
      return () => clearInterval(typeInterval);
    }
  }, [activeStep, isPlaying]);

  // Hook selection animation for step 2
  useEffect(() => {
    if (activeStep === 1 && isPlaying) {
      const timers: NodeJS.Timeout[] = [];

      // Move to first hook
      timers.push(setTimeout(() => {
        moveCursor({ x: 200, y: 95 }, () => {
          // Click after arriving
          setTimeout(() => {
            setIsClicking(true);
            setTimeout(() => {
              setIsClicking(false);
              setSelectedHook(0);
            }, 200);
          }, 300 + Math.random() * 200); // Small random delay before click
        });
      }, 600));

      // Move to second hook
      timers.push(setTimeout(() => {
        moveCursor({ x: 200, y: 155 }, () => {
          setTimeout(() => {
            setIsClicking(true);
            setTimeout(() => {
              setIsClicking(false);
              setSelectedHook(1);
            }, 200);
          }, 250 + Math.random() * 200);
        });
      }, 3200));

      // Move to third hook
      timers.push(setTimeout(() => {
        moveCursor({ x: 200, y: 215 }, () => {
          setTimeout(() => {
            setIsClicking(true);
            setTimeout(() => {
              setIsClicking(false);
              setSelectedHook(2);
            }, 200);
          }, 200 + Math.random() * 200);
        });
      }, 5800));

      return () => timers.forEach(clearTimeout);
    }
  }, [activeStep, isPlaying, moveCursor]);

  // Post animation for step 3
  useEffect(() => {
    if (activeStep === 2 && isPlaying) {
      const timers: NodeJS.Timeout[] = [];

      // Move to post button (right side button, near bottom of card)
      timers.push(setTimeout(() => {
        moveCursor({ x: 280, y: 362 }, () => {
          // Small pause before clicking (human hesitation)
          setTimeout(() => {
            setIsClicking(true);
            setTimeout(() => {
              setIsClicking(false);
              setTimeout(() => setShowPostSuccess(true), 300);
            }, 200);
          }, 400 + Math.random() * 300);
        });
      }, 800));

      return () => timers.forEach(clearTimeout);
    }
  }, [activeStep, isPlaying, moveCursor]);

  // Auto-advance steps with longer delays
  useEffect(() => {
    if (isPlaying) {
      const durations = [5500, 8000, 4500]; // Time per step
      timerRef.current = setTimeout(() => {
        setActiveStep((prev) => (prev + 1) % 3);
      }, durations[activeStep]);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeStep, isPlaying]);

  const handleCopyDemo = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const resetDemo = () => {
    setActiveStep(0);
    setTypingText("");
    setSelectedHook(-1);
    setShowPostSuccess(false);
    setIsPlaying(true);
    jumpCursor({ x: 180, y: 120 });
  };

  // Cursor component with human-like movement
  const AnimatedCursor = () => {
    if (!isPlaying) return null;

    return (
      <div
        className="absolute z-50 pointer-events-none"
        style={{
          left: cursorPos.x,
          top: cursorPos.y,
          // No CSS transition - JavaScript handles the natural movement
        }}
      >
        <div className={`transition-transform duration-100 ${isClicking ? 'scale-75' : 'scale-100'}`}>
          <MousePointer2
            className="w-6 h-6 text-white"
            style={{
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
              transform: 'rotate(-5deg)'
            }}
          />
        </div>
        {isClicking && (
          <div
            className="absolute top-1 left-1 w-4 h-4 bg-white/40 rounded-full"
            style={{
              animation: 'ping 0.4s ease-out'
            }}
          />
        )}
      </div>
    );
  };

  const renderMockup = () => {
    if (activeStep === 0) {
      return (
        <div className="relative" ref={mockupRef}>
          <AnimatedCursor />

          <div className="bg-[#262626] rounded-xl border border-white/10 p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-[#faf7f2]/40 mb-2">Your Content</div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 min-h-[100px]">
                <p className="text-sm text-[#faf7f2]/80 leading-relaxed">
                  {typingText}
                  <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />
                </p>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-[#faf7f2]/30">
                  {typingText.split(' ').filter(w => w).length} words
                </span>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded bg-[#0077b5] text-white text-xs">LinkedIn</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-2 -right-2 bg-amber-500 text-[#1a1a1a] text-xs font-bold px-2 py-1 rounded-full">
            {typingText.length < fullText.length ? "Typing..." : "Done!"}
          </div>
        </div>
      );
    }

    if (activeStep === 1) {
      return (
        <div className="relative" ref={mockupRef}>
          <AnimatedCursor />

          <div className="bg-[#262626] rounded-xl border border-white/10 p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <div className="text-xs text-[#faf7f2]/40 mb-3">Choose your hook</div>
            <div className="space-y-2">
              {hooks.map((hook, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border transition-all duration-500 ${
                    selectedHook === i
                      ? "bg-[#0077b5]/20 border-[#0077b5]/50 ring-2 ring-[#0077b5]/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-500 ${
                      selectedHook === i ? "bg-[#0077b5]" : "bg-white/10"
                    }`}>
                      {selectedHook === i && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <p className={`text-sm transition-all duration-500 ${
                      selectedHook === i ? "text-[#faf7f2]" : "text-[#faf7f2]/60"
                    }`}>
                      {hook}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      );
    }

    // Step 3: Post preview
    const finalHook = selectedHook >= 0 ? selectedHook : 2;

    return (
      <div className="relative" ref={mockupRef}>
        <AnimatedCursor />

        <div className="bg-[#262626] rounded-xl border border-white/10 p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>

          {/* LinkedIn post preview */}
          <div className={`bg-white rounded-lg p-4 text-gray-900 transition-all duration-700 ${
            showPostSuccess ? 'ring-2 ring-green-500/50' : ''
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0077b5] to-[#005885]" />
              <div>
                <div className="font-semibold text-sm">Your Name</div>
                <div className="text-xs text-gray-500">
                  {showPostSuccess ? 'Just now' : 'Preview'} · 🌐
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">{hooks[finalHook].split('.')[0]}.</span>
              {hooks[finalHook].split('.').slice(1).join('.')}
              <br /><br />
              After analyzing 3 years of data:
              <br />
              → 73% want flexibility
              <br />
              → 67% miss collaboration
              <br /><br />
              The answer? Hybrid done right.
            </p>
            <div className="flex gap-4 mt-4 pt-3 border-t text-xs text-gray-500">
              <span>👍 Like</span>
              <span>💬 Comment</span>
              <span>🔄 Repost</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCopyDemo}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/10 text-[#faf7f2] text-sm hover:bg-white/20 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-white text-sm transition-all duration-500 ${
              showPostSuccess ? 'bg-green-500' : 'bg-[#0077b5] hover:bg-[#005885]'
            }`}>
              {showPostSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Posted!
                </>
              ) : (
                <>
                  <Linkedin className="w-4 h-4" />
                  Post
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success indicator */}
        {showPostSuccess && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 animate-bounce">
            <Sparkles className="w-3 h-3" />
            Successfully posted!
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <button
            onClick={resetDemo}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-4 hover:bg-green-500/20 hover:border-green-500/30 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400">See it in action</span>
          </button>
          <h2 className="text-2xl md:text-3xl font-semibold text-[#faf7f2]/90 mb-4">
            From idea to posted in <span className="text-amber-400">60 seconds</span>
          </h2>
          <p className="text-[#faf7f2]/50 text-base max-w-2xl mx-auto">
            No complex prompts. No AI babysitting. Just paste, click, and ship.
          </p>
        </div>

        {/* Demo area */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Steps navigation */}
          <div className="order-2 lg:order-1 space-y-4">
            {steps.map((step, index) => (
              <button
                key={step.number}
                onClick={() => {
                  setActiveStep(index);
                  setIsPlaying(false);
                }}
                className={`w-full text-left p-5 rounded-2xl border transition-all duration-500 ${
                  activeStep === index
                    ? "bg-[#0077b5]/10 border-[#0077b5]/30 shadow-lg shadow-[#0077b5]/10"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold transition-all duration-500 ${
                      activeStep === index
                        ? "bg-[#0077b5] text-white"
                        : activeStep > index
                        ? "bg-green-500 text-white"
                        : "bg-white/10 text-[#faf7f2]/50"
                    }`}
                  >
                    {activeStep > index ? <Check className="w-5 h-5" /> : step.number}
                  </div>
                  <div>
                    <h3 className={`font-semibold mb-1 transition-all ${
                      activeStep === index ? "text-[#faf7f2]" : "text-[#faf7f2]/70"
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-sm transition-all ${
                      activeStep === index ? "text-[#faf7f2]/60" : "text-[#faf7f2]/40"
                    }`}>
                      {step.description}
                    </p>
                  </div>
                  {activeStep === index && (
                    <ArrowRight className="w-5 h-5 text-[#0077b5] flex-shrink-0 ml-auto" />
                  )}
                </div>
              </button>
            ))}

            {/* Playback controls */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={togglePlayPause}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-[#faf7f2] text-sm transition-all"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Play
                  </>
                )}
              </button>
              <button
                onClick={resetDemo}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-[#faf7f2] text-sm transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0077b5] transition-all duration-700"
                style={{ width: `${((activeStep + 1) / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Mockup display */}
          <div className="order-1 lg:order-2">
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0077b5]/20 to-amber-500/20 blur-3xl rounded-full opacity-30" />

              {/* Mockup container */}
              <div className="relative p-6 md:p-8">
                <div className="transition-opacity duration-500">
                  {renderMockup()}
                </div>
              </div>

              {/* Step indicator dots */}
              <div className="flex justify-center gap-2 mt-6">
                {steps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveStep(index);
                      setIsPlaying(false);
                    }}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      activeStep === index
                        ? "bg-[#0077b5] w-8"
                        : "bg-white/20 hover:bg-white/40 w-2"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
