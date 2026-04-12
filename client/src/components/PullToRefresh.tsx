import { useState, useRef, useCallback, ReactNode, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  threshold?: number;
  maxPull?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  className = "",
  threshold = 60,
  maxPull = 100,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  // Check if we're at the top of the scroll
  const isAtTop = useCallback(() => {
    if (!containerRef.current) return false;
    // Check if container is at top or if the window is at top
    const containerAtTop = containerRef.current.scrollTop <= 0;
    const windowAtTop = window.scrollY <= 0;
    return containerAtTop && windowAtTop;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    
    startY.current = e.touches[0].clientY;
    startScrollTop.current = containerRef.current?.scrollTop || 0;
    
    // Only start pulling if at the top
    if (isAtTop()) {
      setIsPulling(true);
    }
  }, [isRefreshing, isAtTop]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    // Only pull down if we're at the top and pulling down
    if (diff > 0 && isAtTop()) {
      // Apply resistance to pull
      const resistance = 0.4;
      const pullAmount = Math.min(diff * resistance, maxPull);
      setPullDistance(pullAmount);
      
      // Prevent default scroll when pulling
      if (pullAmount > 5) {
        e.preventDefault();
      }
    } else if (diff < 0) {
      // If pulling up, reset and allow normal scroll
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [isPulling, isRefreshing, maxPull, isAtTop]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || isRefreshing) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error("Refresh failed:", error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    setIsPulling(false);
    setPullDistance(0);
  }, []);

  // Reset state when component unmounts or refreshing ends
  useEffect(() => {
    return () => {
      setPullDistance(0);
      setIsPulling(false);
    };
  }, []);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ 
        touchAction: pullDistance > 5 ? "none" : "pan-y",
        overscrollBehavior: "contain",
      }}
    >
      {/* Pull indicator */}
      <div
        className="fixed left-1/2 -translate-x-1/2 flex items-center justify-center z-[100] transition-all duration-200 pointer-events-none"
        style={{
          top: `${Math.max(pullDistance - 20, 0)}px`,
          opacity: pullDistance > 10 ? 1 : 0,
          transform: `translateX(-50%) scale(${0.8 + progress * 0.2})`,
        }}
      >
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 shadow-xl border-2 border-emerald-200 dark:border-emerald-700 transition-all duration-200 ${
            isRefreshing ? "scale-110" : ""
          }`}
        >
          {isRefreshing ? (
            <Loader2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-spin" />
          ) : (
            <RefreshCw
              className="w-6 h-6 text-emerald-600 dark:text-emerald-400 transition-transform"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Refresh status text */}
      {pullDistance > 10 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[99] text-center pointer-events-none transition-opacity duration-200"
          style={{
            top: `${Math.max(pullDistance + 35, 55)}px`,
            opacity: pullDistance > 20 ? 1 : 0,
          }}
        >
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full shadow-sm">
            {isRefreshing 
              ? "جاري التحديث..." 
              : pullDistance >= threshold 
                ? "أفلت للتحديث" 
                : "اسحب للتحديث"
            }
          </span>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        ref={contentRef}
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
