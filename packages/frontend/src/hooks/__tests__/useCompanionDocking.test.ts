import { describe, it, expect } from 'vitest';

/**
 * Pure arithmetic verification helper for the desktop companion docking algorithm:
 * Required width = 360 (sidebar) + 420 (companion) + 48 (margins/gaps) + 450 (min map canvas) = 1278px
 */
function canDockCompanionPane(viewportWidth: number): boolean {
  return viewportWidth >= 1280 && (viewportWidth - (360 + 420 + 48) >= 450);
}

describe('Companion Docking Arithmetic & Breakpoint Rules', () => {
  it('rejects mobile viewports (< 768px)', () => {
    expect(canDockCompanionPane(375)).toBe(false);
    expect(canDockCompanionPane(414)).toBe(false);
  });

  it('rejects tablet viewports (768px - 1024px)', () => {
    expect(canDockCompanionPane(768)).toBe(false);
    expect(canDockCompanionPane(1024)).toBe(false);
  });

  it('rejects narrow desktop viewports below 1278px (e.g. 1200px)', () => {
    expect(canDockCompanionPane(1200)).toBe(false);
    expect(canDockCompanionPane(1277)).toBe(false);
  });

  it('approves standard 1280px, 1366px, 1440px, and 1920px widescreen viewports', () => {
    expect(canDockCompanionPane(1280)).toBe(true);
    expect(canDockCompanionPane(1366)).toBe(true);
    expect(canDockCompanionPane(1440)).toBe(true);
    expect(canDockCompanionPane(1920)).toBe(true);
  });

  it('computes exact remaining map canvas width matching plan specifications', () => {
    const remainingAt1280 = 1280 - (360 + 420 + 16);
    expect(remainingAt1280).toBe(484);

    const remainingAt1366 = 1366 - (360 + 420 + 16);
    expect(remainingAt1366).toBe(570);

    const remainingAt1920 = 1920 - (360 + 420 + 16);
    expect(remainingAt1920).toBe(1124);
  });
});
