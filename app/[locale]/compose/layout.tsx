'use client';

import { useEffect } from 'react';
import { audioEngine } from '@/lib/audio';
import { useMobileDetection } from '@/hooks';

interface ComposeLayoutProps {
    children: React.ReactNode;
}

export default function ComposeLayout({ children }: ComposeLayoutProps) {
    useMobileDetection();

    useEffect(() => {
        return () => {
            audioEngine.stop();
        };
    }, []);

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            {children}
        </div>
    );
}
