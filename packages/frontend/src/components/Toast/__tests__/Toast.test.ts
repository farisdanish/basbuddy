import { describe, it, expect } from 'vitest';
import { toast } from '../Toast.tsx';

describe('toast utility', () => {
  it('exposes success, error, info methods', () => {
    expect(typeof toast.success).toBe('function');
    expect(typeof toast.error).toBe('function');
    expect(typeof toast.info).toBe('function');
    expect(typeof toast.show).toBe('function');

    // Calling them does not throw
    expect(() => toast.success('Saved!')).not.toThrow();
    expect(() => toast.error('Failed to copy')).not.toThrow();
    expect(() => toast.info('Notice')).not.toThrow();
  });
});
