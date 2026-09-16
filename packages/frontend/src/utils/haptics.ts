/**
 * Subtle tactile feedback for key interactions (favorites, tab switches).
 * Feature-detected with silent fallback for unsupported platforms (iOS Safari, desktop).
 */
export function tapFeedback(pattern: number | number[] = 10): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration failures/permission issues
    }
  }
}
