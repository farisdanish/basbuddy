import { useState, useEffect } from 'react';

/**
 * Returns true if the viewport is wide enough to dock the Timetable companion
 * side-by-side with RouteTrackerSheet (360px sidebar + 420px companion + 48px padding = 828px footprint)
 * while leaving at least 450px of visible map canvas.
 *
 * Math:
 * Minimum viewport required = 360px (sidebar) + 420px (companion) + 48px (margins/gaps) + 450px (map) = 1278px ≈ 1280px (xl breakpoint).
 */
export function useCompanionDocking(): boolean {
  const [canDock, setCanDock] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1280 && (window.innerWidth - 828 >= 450);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const isWideEnough = window.innerWidth >= 1280 && (window.innerWidth - 828 >= 450);
      setCanDock((prev) => (prev !== isWideEnough ? isWideEnough : prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return canDock;
}
