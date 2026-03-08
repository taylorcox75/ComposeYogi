'use client';

import { useEffect } from 'react';
import { audioEngine } from '@/lib/audio';

interface ComposeLayoutProps {
    children: React.ReactNode;
}

export default function ComposeLayout({ children }: ComposeLayoutProps) {
    // Initialize audio engine on mount
    useEffect(() => {
        // Audio context will be initialized on first user interaction
        // due to browser autoplay policies
        return () => {
            // Cleanup on unmount
            audioEngine.stop();
        };
    }, []);

    return (
        <div
            className="flex flex-col overflow-hidden bg-background"
            style={{
                // Use dynamic viewport height so the layout doesn't overflow behind the iOS URL bar
                height: '100dvh',
                // Respect iOS safe areas (notch, Dynamic Island, home indicator) in PWA/standalone mode
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
            }}
        >
            {children}
        </div>
    );
}
