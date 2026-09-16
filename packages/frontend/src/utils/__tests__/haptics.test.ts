import { describe, it, expect, vi } from 'vitest';
import { tapFeedback } from '../haptics.ts';

describe('tapFeedback', () => {
  it('calls navigator.vibrate when available', () => {
    const vibrateMock = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibrateMock });

    tapFeedback(15);
    expect(vibrateMock).toHaveBeenCalledWith(15);

    vi.unstubAllGlobals();
  });

  it('handles environment where navigator.vibrate is undefined without error', () => {
    vi.stubGlobal('navigator', {});
    expect(() => tapFeedback(10)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
