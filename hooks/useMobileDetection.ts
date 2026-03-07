'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/store';

const MOBILE_BREAKPOINT = 768;

export function useMobileDetection() {
    const setIsMobile = useUIStore((s) => s.setIsMobile);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

        const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
            setIsMobile(e.matches);
        };

        handleChange(mql);
        mql.addEventListener('change', handleChange);

        return () => mql.removeEventListener('change', handleChange);
    }, [setIsMobile]);
}
