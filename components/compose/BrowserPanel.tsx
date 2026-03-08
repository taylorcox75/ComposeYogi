'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    LayoutTemplate,
    Piano,
    Music,
    Sparkles,
    ChevronRight,
    ChevronDown,
    Search,
    PlusCircle,
    GripVertical,
    Play,
    Trash2,
    Upload,
    Loader2,
    FolderOpen,
} from 'lucide-react';
import { useUIStore, useProjectStore } from '@/lib/store';
import { Button } from '@/components/ui';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    TEMPLATES,
    INSTRUMENTS,
    SAMPLE_FOLDERS,
    FX_PRESETS,
    INSTRUMENT_CATEGORIES,
    FX_CATEGORIES,
    type BrowserTab,
    type TemplateItem,
    type InstrumentItem,
    type SampleFolder,
    type SampleItem,
    type FXPreset,
} from '@/lib/browser';
import {
    importAudioFile,
    getUserSamples,
    removeUserSample,
    createSamplePreviewUrl,
    loadSampleAsAudioTake,
    loadUserSampleAsAudioTake,
    audioEngine,
    SUPPORTED_EXTENSIONS,
} from '@/lib/audio';
import type { UserSample } from '@/types';
import { createLogger } from '@/lib/logger';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';

const log = createLogger('BrowserPanel');

// ============================================
// Tab Configuration
// ============================================

const TABS: { id: BrowserTab; label: string; icon: typeof LayoutTemplate }[] = [
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'instruments', label: 'Instruments', icon: Piano },
    { id: 'samples', label: 'Samples', icon: Music },
    { id: 'fx', label: 'FX', icon: Sparkles },
];

// ============================================
// Helper Functions
// ============================================

const getTrackColorClass = (color: string): string => {
    switch (color) {
        case 'drums': return 'red-500';
        case 'bass': return 'blue-500';
        case 'keys': return 'orange-400';
        case 'melody': return 'purple-500';
        case 'vocals': return 'green-500';
        case 'fx': return 'pink-500';
        default: return 'gray-500';
    }
};

// ============================================
// BrowserPanel Component
// ============================================

export function BrowserPanel() {
    const [activeTab, setActiveTab] = useState<BrowserTab>('templates');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['drums', 'user-samples']));
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['synth', 'reverb']));

    // User samples state
    const [userSamples, setUserSamples] = useState<UserSample[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [previewingId, setPreviewingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const touchGhostRef = useRef<HTMLDivElement | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const touchDragDataRef = useRef<{ data: any; label: string } | null>(null);

    const isMobile = useIsMobile();

    const toggleBrowser = useUIStore((s) => s.toggleBrowser);
    const selectedTrackId = useUIStore((s) => s.selectedTrackId);
    const selectClip = useUIStore((s) => s.selectClip);
    const createProject = useProjectStore((s) => s.createProject);
    const addTrack = useProjectStore((s) => s.addTrack);
    const updateTrack = useProjectStore((s) => s.updateTrack);
    const addClip = useProjectStore((s) => s.addClip);
    const updateClip = useProjectStore((s) => s.updateClip);
    const addTrackEffect = useProjectStore((s) => s.addTrackEffect);

    const loadUserSamples = useCallback(async () => {
        try {
            const samples = await getUserSamples();
            setUserSamples(samples);
        } catch (error) {
            log.error('Failed to load user samples', error);
        }
    }, []);

    // Load user samples on mount
    useEffect(() => {
        loadUserSamples();
    }, [loadUserSamples]);

    const toggleFolder = useCallback((folderId: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    }, []);

    const toggleCategory = useCallback((categoryId: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    }, []);

    // ========================================
    // Drag Handlers
    // ========================================

    const handleInstrumentDrag = useCallback((e: React.DragEvent, instrument: InstrumentItem) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'instrument',
            data: instrument,
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    const handleSampleDrag = useCallback((e: React.DragEvent, sample: SampleItem, folder: SampleFolder) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'sample',
            data: { ...sample, folderId: folder.id },
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    const handleSampleClick = useCallback((sample: SampleItem) => {
        const audio = new Audio(sample.url);
        audio.play().catch(err => console.error('Failed to play preview:', err));
    }, []);

    const handleFXDrag = useCallback((e: React.DragEvent, fx: FXPreset) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'fx',
            data: fx,
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    // ========================================
    // Touch Drag Handlers (iOS / mobile)
    // HTML5 drag events don't fire from touch, so we use touch events to
    // simulate drag-and-drop: ghost element follows finger, on lift we
    // dispatch a custom 'browser-touch-drop' event on the track lane below.
    // ========================================

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleTouchDragStart = useCallback((data: any, label: string, e: React.TouchEvent) => {
        // Don't hijack taps on explicit action buttons (+ add, delete)
        const target = e.target as HTMLElement;
        if (target.closest('[data-no-drag]')) return;
        if (target.closest('button')) return;
        touchDragDataRef.current = { data, label };
    }, []);

    // Global non-passive touchmove: update ghost position, prevent scroll
    // Registered via useEffect below (React passive listeners can't call preventDefault)
    const touchMoveHandler = useCallback((e: TouchEvent) => {
        if (!touchDragDataRef.current) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (!touchGhostRef.current) {
            const ghost = document.createElement('div');
            ghost.style.cssText = [
                'position:fixed',
                'z-index:9999',
                'pointer-events:none',
                'background:hsl(var(--accent))',
                'color:hsl(var(--accent-foreground))',
                'padding:4px 10px',
                'border-radius:6px',
                'font-size:12px',
                'font-weight:500',
                'opacity:0.9',
                'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
                'white-space:nowrap',
            ].join(';');
            ghost.textContent = touchDragDataRef.current.label;
            document.body.appendChild(ghost);
            touchGhostRef.current = ghost;
        }
        touchGhostRef.current.style.left = `${touch.clientX + 12}px`;
        touchGhostRef.current.style.top = `${touch.clientY - 24}px`;
    }, []);

    // Global touchend: find drop target, dispatch event, clean up
    const touchEndHandler = useCallback((e: TouchEvent) => {
        if (!touchDragDataRef.current) return;
        const touch = e.changedTouches[0];

        if (touchGhostRef.current) {
            document.body.removeChild(touchGhostRef.current);
            touchGhostRef.current = null;
        }

        // Use bounding-rect lookup instead of elementFromPoint to bypass z-index
        // overlays (backdrop, panel containers) that would otherwise intercept the hit-test.
        const trackLanes = document.querySelectorAll<HTMLElement>('[data-track-id]');
        let dropTarget: HTMLElement | null = null;
        for (const lane of trackLanes) {
            const rect = lane.getBoundingClientRect();
            if (
                touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom
            ) {
                dropTarget = lane;
                break;
            }
        }

        if (dropTarget) {
            dropTarget.dispatchEvent(new CustomEvent('browser-touch-drop', {
                bubbles: false,
                detail: { data: touchDragDataRef.current.data, clientX: touch.clientX },
            }));
        }

        touchDragDataRef.current = null;
    }, []);

    // Register global non-passive touch listeners
    useEffect(() => {
        document.addEventListener('touchmove', touchMoveHandler, { passive: false });
        document.addEventListener('touchend', touchEndHandler);
        return () => {
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);
        };
    }, [touchMoveHandler, touchEndHandler]);

    // ========================================
    // User Sample Handlers
    // ========================================

    const handleImportClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsImporting(true);

        try {
            for (const file of Array.from(files)) {
                try {
                    await importAudioFile(file, {
                        onProgress: (progress) => {
                            log.debug('Import progress', { stage: progress.stage, progress: progress.progress });
                        },
                    });
                    toast.success(`Imported "${file.name}"`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    toast.error(`Failed to import "${file.name}": ${message}`);
                    log.error('Import failed', { file: file.name, error });
                }
            }
            // Reload samples list
            await loadUserSamples();
        } finally {
            setIsImporting(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [loadUserSamples]);

    const handleUserSampleDrag = useCallback((e: React.DragEvent, sample: UserSample) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'user-sample',
            data: {
                id: sample.id,
                name: sample.name,
                duration: sample.duration,
                sampleRate: sample.sampleRate,
            },
        }));
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    const handleUserSampleClick = useCallback((sample: UserSample) => {
        // Stop any currently playing preview
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }

        // If clicking the same sample that's playing, just stop it
        if (previewingId === sample.id) {
            setPreviewingId(null);
            return;
        }

        // Create and play preview
        const url = createSamplePreviewUrl(sample);
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        setPreviewingId(sample.id);

        audio.onended = () => {
            URL.revokeObjectURL(url);
            setPreviewingId(null);
            previewAudioRef.current = null;
        };

        audio.onerror = () => {
            URL.revokeObjectURL(url);
            setPreviewingId(null);
            previewAudioRef.current = null;
            toast.error('Failed to play sample');
        };

        audio.play().catch((err) => {
            log.error('Failed to play preview', err);
            URL.revokeObjectURL(url);
            setPreviewingId(null);
        });
    }, [previewingId]);

    const handleDeleteUserSample = useCallback(async (e: React.MouseEvent, sample: UserSample) => {
        e.stopPropagation();

        if (!confirm(`Delete "${sample.name}"? This cannot be undone.`)) {
            return;
        }

        try {
            await removeUserSample(sample.id);
            toast.success(`Deleted "${sample.name}"`);
            await loadUserSamples();
        } catch (error) {
            toast.error('Failed to delete sample');
            log.error('Delete failed', error);
        }
    }, [loadUserSamples]);

    // ========================================
    // Mobile Tap-to-Add Handlers
    // (On desktop items are added via drag-and-drop; on touch that doesn't work)
    // ========================================

    const handleSampleTapAdd = useCallback((sample: SampleItem) => {
        if (!selectedTrackId) {
            toast.error('Select a track first, then tap + to add a sample');
            return;
        }
        const clip = addClip(selectedTrackId, 'audio', 0, 1);
        loadSampleAsAudioTake(sample.url, sample.name, clip.id)
            .then((take) => {
                const lengthBars = Math.max(0.25, audioEngine.secondsToBar(take.duration));
                updateClip(clip.id, {
                    name: sample.name,
                    audioTakeIds: [take.id],
                    activeTakeId: take.id,
                    lengthBars,
                });
                selectClip(clip.id);
            })
            .catch(() => toast.error(`Failed to load "${sample.name}"`));
        toast.success(`Added "${sample.name}" to track`);
    }, [selectedTrackId, addClip, updateClip, selectClip]);

    const handleUserSampleTapAdd = useCallback((sample: UserSample) => {
        if (!selectedTrackId) {
            toast.error('Select a track first, then tap + to add a sample');
            return;
        }
        const clip = addClip(selectedTrackId, 'audio', 0, 1);
        loadUserSampleAsAudioTake(sample.id, clip.id)
            .then((take) => {
                const lengthBars = Math.max(0.25, audioEngine.secondsToBar(take.duration));
                updateClip(clip.id, {
                    name: sample.name,
                    audioTakeIds: [take.id],
                    activeTakeId: take.id,
                    lengthBars,
                });
                selectClip(clip.id);
            })
            .catch(() => toast.error(`Failed to load "${sample.name}"`));
        toast.success(`Added "${sample.name}" to track`);
    }, [selectedTrackId, addClip, updateClip, selectClip]);

    const handleFXTapAdd = useCallback((fx: FXPreset) => {
        if (!selectedTrackId) {
            toast.error('Select a track first, then tap + to add an effect');
            return;
        }
        addTrackEffect(selectedTrackId, fx.category, fx.id);
        toast.success(`Added ${fx.name} to track`);
    }, [selectedTrackId, addTrackEffect]);

    // ========================================
    // Template Click Handler
    // ========================================

    const handleTemplateClick = useCallback((template: TemplateItem) => {
        // Create new project from template
        createProject(template.name, template.id);
    }, [createProject]);

    // ========================================
    // Instrument Double-Click (Add Track)
    // ========================================

    const handleInstrumentDoubleClick = useCallback((instrument: InstrumentItem) => {
        const track = addTrack(instrument.trackType, instrument.name, instrument.trackColor);
        // Set the synth preset so the track produces the correct sound
        updateTrack(track.id, { instrumentPreset: instrument.id });
    }, [addTrack, updateTrack]);

    // ========================================
    // Filter Logic
    // ========================================

    const filterBySearch = useCallback(<T extends { name: string }>(items: T[]): T[] => {
        if (!searchQuery) return items;
        const query = searchQuery.toLowerCase();
        return items.filter((item) => item.name.toLowerCase().includes(query));
    }, [searchQuery]);

    // ========================================
    // Render Templates Tab
    // ========================================

    const renderTemplates = () => {
        const filtered = filterBySearch(TEMPLATES);

        return (
            <div className="grid grid-cols-1 gap-2 p-2">
                {filtered.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        className="group flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-3 text-left transition-all hover:border-accent hover:bg-surface-elevated/80"
                    >
                        <span className="text-2xl">{template.emoji}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{template.name}</span>
                                <span className="text-xs text-muted-foreground">{template.bpm} BPM</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {template.description}
                            </p>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                                    {template.genre}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                                    {template.key} {template.scale}
                                </span>
                            </div>
                        </div>
                        <Play className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
                {filtered.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No templates found
                    </p>
                )}
            </div>
        );
    };

    // ========================================
    // Render Instruments Tab
    // ========================================

    const renderInstruments = () => {
        const filteredInstruments = filterBySearch(INSTRUMENTS);

        return (
            <div className="p-2">
                {INSTRUMENT_CATEGORIES.map((category) => {
                    const categoryInstruments = filteredInstruments.filter(
                        (i) => i.category === category.id
                    );
                    if (categoryInstruments.length === 0) return null;

                    const isExpanded = expandedCategories.has(category.id);

                    return (
                        <div key={category.id} className="mb-1">
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                            >
                                <span className="text-muted-foreground">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                </span>
                                <span>{category.icon}</span>
                                <span className="font-medium">{category.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {categoryInstruments.length}
                                </span>
                            </button>
                            {isExpanded && (
                                <div className="ml-4 space-y-1 mt-1">
                                    {categoryInstruments.map((instrument) => (
                                        <Tooltip key={instrument.id}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    draggable={!isMobile}
                                                    onDragStart={(e) => handleInstrumentDrag(e, instrument)}
                                                    onDoubleClick={() => handleInstrumentDoubleClick(instrument)}
                                                    onTouchStart={(e) => handleTouchDragStart({ type: 'instrument', data: instrument }, instrument.name, e)}
                                                    className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group relative"
                                                >
                                                    <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />

                                                    {/* Color Indicator */}
                                                    <div className={`w-1.5 h-1.5 rounded-full bg-${getTrackColorClass(instrument.trackColor)}`} />

                                                    <Piano className="h-4 w-4 text-muted-foreground" />

                                                    <span className="flex-1 text-foreground truncate">{instrument.name}</span>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleInstrumentDoubleClick(instrument);
                                                        }}
                                                        className={`p-1 hover:bg-surface-active rounded transition-all ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                        aria-label="Add Track"
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                                <p className="font-medium">{instrument.name}</p>
                                                <p className="text-xs text-primary-foreground/80">{instrument.description}</p>
                                                <div className="mt-1 flex gap-2">
                                                    <span className="text-[10px] bg-background/20 text-primary-foreground px-1 py-0.5 rounded uppercase tracking-wider font-semibold backdrop-blur-sm">
                                                        {instrument.trackType}
                                                    </span>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ========================================
    // Render Samples Tab
    // ========================================

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderSamples = () => {
        // Filter user samples by search
        const filteredUserSamples = userSamples.filter((s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const showUserSamplesFolder = !searchQuery || filteredUserSamples.length > 0;
        const isUserSamplesExpanded = expandedFolders.has('user-samples');

        return (
            <div className="p-2">
                {/* User Samples Folder */}
                {showUserSamplesFolder && (
                    <div className="mb-1">
                        <button
                            onClick={() => toggleFolder('user-samples')}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                        >
                            <span className="text-muted-foreground">
                                {isUserSamplesExpanded ? (
                                    <ChevronDown className="h-3 w-3" />
                                ) : (
                                    <ChevronRight className="h-3 w-3" />
                                )}
                            </span>
                            <FolderOpen className="h-4 w-4 text-accent" />
                            <span className="font-medium text-accent">My Samples</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {userSamples.length}
                            </span>
                        </button>
                        {isUserSamplesExpanded && (
                            <div className="ml-4">
                                {filteredUserSamples.length === 0 ? (
                                    <p className="py-2 px-2 text-xs text-muted-foreground italic">
                                        No imported samples yet
                                    </p>
                                ) : (
                                    filteredUserSamples.map((sample) => (
                                        <div
                                            key={sample.id}
                                            draggable={!isMobile}
                                            onClick={() => handleUserSampleClick(sample)}
                                            onDragStart={(e) => handleUserSampleDrag(e, sample)}
                                            onTouchStart={(e) => handleTouchDragStart({
                                                type: 'user-sample',
                                                data: { id: sample.id, name: sample.name, duration: sample.duration, sampleRate: sample.sampleRate },
                                            }, sample.name, e)}
                                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group ${previewingId === sample.id ? 'bg-accent/10' : ''
                                                }`}
                                        >
                                            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                            {previewingId === sample.id ? (
                                                <Play className="h-4 w-4 text-accent animate-pulse" />
                                            ) : (
                                                <Music className="h-4 w-4 text-accent/70" />
                                            )}
                                            <span className="flex-1 text-foreground truncate">
                                                {sample.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatDuration(sample.duration)}
                                            </span>
                                            {isMobile && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleUserSampleTapAdd(sample); }}
                                                    className="p-1 hover:bg-surface-active rounded"
                                                    aria-label="Add to track"
                                                >
                                                    <PlusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteUserSample(e, sample)}
                                                className={`p-1 hover:bg-destructive/20 rounded transition-all ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                aria-label="Delete sample"
                                            >
                                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Built-in Sample Folders */}
                {SAMPLE_FOLDERS.map((folder) => {
                    const isExpanded = expandedFolders.has(folder.id);
                    const filteredSamples = filterBySearch(folder.samples);

                    // Skip folder if search is active and no matches
                    if (searchQuery && filteredSamples.length === 0) return null;

                    return (
                        <div key={folder.id} className="mb-1">
                            <button
                                onClick={() => toggleFolder(folder.id)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                            >
                                <span className="text-muted-foreground">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                </span>
                                <span>{folder.icon}</span>
                                <span className="font-medium">{folder.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {folder.samples.length}
                                </span>
                            </button>
                            {isExpanded && (
                                <div className="ml-4">
                                    {(searchQuery ? filteredSamples : folder.samples).map((sample) => (
                                        <div
                                            key={sample.id}
                                            draggable={!isMobile}
                                            onClick={() => handleSampleClick(sample)}
                                            onDragStart={(e) => handleSampleDrag(e, sample, folder)}
                                            onTouchStart={(e) => handleTouchDragStart({ type: 'sample', data: { ...sample, folderId: folder.id } }, sample.name, e)}
                                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group"
                                        >
                                            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                            <Music className="h-4 w-4 text-muted-foreground" />
                                            <span className="flex-1 text-muted-foreground truncate">
                                                {sample.name}
                                            </span>
                                            {sample.bpm && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    {sample.bpm}
                                                </span>
                                            )}
                                            {isMobile && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleSampleTapAdd(sample); }}
                                                    className="p-1 hover:bg-surface-active rounded"
                                                    aria-label="Add to track"
                                                >
                                                    <PlusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ========================================
    // Render FX Tab
    // ========================================

    const renderFX = () => {
        const filteredFX = filterBySearch(FX_PRESETS);

        return (
            <div className="p-2">
                {FX_CATEGORIES.map((category) => {
                    const categoryFX = filteredFX.filter((f) => f.category === category.id);
                    if (categoryFX.length === 0) return null;

                    const isExpanded = expandedCategories.has(category.id);

                    return (
                        <div key={category.id} className="mb-1">
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-elevated"
                            >
                                <span className="text-muted-foreground">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3 w-3" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3" />
                                    )}
                                </span>
                                <span>{category.icon}</span>
                                <span className="font-medium">{category.name}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                    {categoryFX.length}
                                </span>
                            </button>
                            {isExpanded && (
                                <div className="ml-4">
                                    {categoryFX.map((fx) => (
                                        <div
                                            key={fx.id}
                                            draggable={!isMobile}
                                            onDragStart={(e) => handleFXDrag(e, fx)}
                                            onTouchStart={(e) => handleTouchDragStart({ type: 'fx', data: fx }, fx.name, e)}
                                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-surface-elevated group"
                                            title={fx.description}
                                        >
                                            <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                                            <span className="flex-1 text-muted-foreground">
                                                {fx.name}
                                            </span>
                                            {isMobile && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleFXTapAdd(fx); }}
                                                    className="p-1 hover:bg-surface-active rounded"
                                                    aria-label="Add to track"
                                                >
                                                    <PlusCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ========================================
    // Render Content Based on Tab
    // ========================================

    const renderContent = () => {
        switch (activeTab) {
            case 'templates':
                return renderTemplates();
            case 'instruments':
                return renderInstruments();
            case 'samples':
                return renderSamples();
            case 'fx':
                return renderFX();
            default:
                return null;
        }
    };

    return (
        <aside className={`flex flex-col border-border bg-surface overflow-hidden ${isMobile ? 'w-full flex-1 border-t' : 'w-browser border-r'}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">Browser</h2>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleBrowser}
                            className="h-6 w-6"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <p>Close Browser <kbd className="ml-1 text-xs opacity-60">B</kbd></p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <Tooltip key={tab.id}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center py-2.5 transition-colors ${isActive
                                        ? 'text-accent border-b-2 border-accent -mb-[1px]'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{tab.label}</p>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>

            {/* Search */}
            <div className="border-b border-border p-2">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {renderContent()}
            </div>

            {/* Footer: Import (only show for samples tab) */}
            {activeTab === 'samples' && (
                <div className="border-t border-border p-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={SUPPORTED_EXTENSIONS.join(',')}
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={handleImportClick}
                        disabled={isImporting}
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                Import Audio
                            </>
                        )}
                    </Button>
                    <p className="mt-1 text-[10px] text-muted-foreground text-center">
                        WAV, MP3, OGG, FLAC, M4A (max 50MB)
                    </p>
                </div>
            )}
        </aside>
    );
}

// Collapsed bar to show browser
export function BrowserCollapsedBar() {
    const toggleBrowser = useUIStore((s) => s.toggleBrowser);

    return (
        <div className="border-r border-border bg-background h-full">
            <button
                onClick={toggleBrowser}
                className="h-full w-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
                <ChevronRight className="h-3 w-3" />
                <span className="writing-mode-vertical text-[10px] tracking-wider">BROWSER</span>
                <kbd className="px-1 py-0.5 text-[10px] font-mono bg-muted border border-border rounded">B</kbd>
            </button>
        </div>
    );
}
