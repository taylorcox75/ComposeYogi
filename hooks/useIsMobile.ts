import { useState, useEffect } from 'react';

/**
 * Detects whether the user is on a touch-based mobile device (iOS/Android).
 * Returns false on desktop — even touch-enabled desktops (Wacom, Surface in desktop mode).
 * Safe to use for SSR (returns false until hydrated).
 */
function detectMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    return navigator.maxTouchPoints > 0 && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function useIsMobile(): boolean {
    // Initialize synchronously on the client so there's no flash from false→true on mobile.
    // Falls back to false during SSR (navigator is undefined).
    const [isMobile] = useState(detectMobile);
    return isMobile;
}
