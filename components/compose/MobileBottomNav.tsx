'use client';

import {
    LayoutList,
    Piano,
    Sliders,
    Music,
} from 'lucide-react';
import { useUIStore } from '@/lib/store';

const tabs = [
    { id: 'tracks', label: 'Tracks', icon: LayoutList },
    { id: 'browser', label: 'Browser', icon: Music },
    { id: 'editor', label: 'Editor', icon: Piano },
    { id: 'inspector', label: 'Inspector', icon: Sliders },
] as const;

type TabId = typeof tabs[number]['id'];

export function MobileBottomNav() {
    const browserOpen = useUIStore((s) => s.browserOpen);
    const inspectorOpen = useUIStore((s) => s.inspectorOpen);
    const editorOpen = useUIStore((s) => s.editorOpen);
    const toggleBrowser = useUIStore((s) => s.toggleBrowser);
    const toggleInspector = useUIStore((s) => s.toggleInspector);
    const toggleEditor = useUIStore((s) => s.toggleEditor);

    const isActive = (id: TabId) => {
        switch (id) {
            case 'tracks': return !browserOpen && !inspectorOpen && !editorOpen;
            case 'browser': return browserOpen;
            case 'editor': return editorOpen;
            case 'inspector': return inspectorOpen;
        }
    };

    const handleTap = (id: TabId) => {
        switch (id) {
            case 'tracks':
                if (browserOpen) toggleBrowser();
                if (inspectorOpen) toggleInspector();
                if (editorOpen) toggleEditor();
                break;
            case 'browser':
                if (inspectorOpen) toggleInspector();
                if (editorOpen) toggleEditor();
                if (!browserOpen) toggleBrowser();
                else toggleBrowser();
                break;
            case 'editor':
                if (browserOpen) toggleBrowser();
                if (inspectorOpen) toggleInspector();
                if (!editorOpen) toggleEditor();
                else toggleEditor();
                break;
            case 'inspector':
                if (browserOpen) toggleBrowser();
                if (editorOpen) toggleEditor();
                if (!inspectorOpen) toggleInspector();
                else toggleInspector();
                break;
        }
    };

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border bg-card mobile-bottom-nav">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.id);
                return (
                    <button
                        key={tab.id}
                        onClick={() => handleTap(tab.id)}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                            active
                                ? 'text-accent'
                                : 'text-muted-foreground active:text-foreground'
                        }`}
                    >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
