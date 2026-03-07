import { useState, useEffect } from 'react';

/**
 * Detects whether the user is on a touch-based mobile device (iOS/Android).
 * Returns false on desktop — even touch-enabled desktops (Wacom, Surface in desktop mode).
 * Safe to use for SSR (returns false until hydrated).
 */
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check =
            navigator.maxTouchPoints > 0 &&
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setIsMobile(check);
    }, []);

    return isMobile;
}
