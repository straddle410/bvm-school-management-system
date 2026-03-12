import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    if (containerRef.current?.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - startYRef.current;
    
    if (distance > 0) {
      setPullDistance(Math.min(distance, 100));
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      setIsRefreshing(true);
      onRefresh().finally(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      });
    } else {
      setPullDistance(0);
    }
    setIsPulling(false);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-y-auto"
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center transition-all duration-200 overflow-hidden"
        style={{
          height: `${Math.max(pullDistance, 0)}px`,
          opacity: Math.min(pullDistance / 60, 1),
        }}
      >
        <div className="flex items-center gap-2">
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: `rotate(${pullDistance}deg)`,
            }}
          />
          <span className="text-xs text-slate-500">
            {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}