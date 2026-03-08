// ============================================
// ComposeYogi — Loop Braces Component
// Draggable loop region markers on the ruler
// ============================================

'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { usePlaybackStore } from '@/lib/store';

const HANDLE_WIDTH = 12; // Wider handles for easier touch targeting
const MIN_LOOP_BARS = 1; // Minimum loop length

type DragMode = 'left' | 'right' | 'move' | null;

interface LoopBracesProps {
    pixelsPerBar: number;
    rulerHeight: number;
}

export function LoopBraces({ pixelsPerBar, rulerHeight }: LoopBracesProps) {
    const loopEnabled = usePlaybackStore((s) => s.loopEnabled);
    const loopStartBar = usePlaybackStore((s) => s.loopStartBar);
    const loopEndBar = usePlaybackStore((s) => s.loopEndBar);
    const setLoopRegion = usePlaybackStore((s) => s.setLoopRegion);
    const toggleLoop = usePlaybackStore((s) => s.toggleLoop);

    const [dragMode, setDragMode] = useState<DragMode>(null);
    const [dragOffset, setDragOffset] = useState({ start: 0, end: 0 });

    const dragStartRef = useRef<{
        x: number;
        originalStart: number;
        originalEnd: number;
    } | null>(null);

    // Track last tap time for double-tap detection on touch
    const lastTapRef = useRef<number>(0);

    // Visual positions (with drag offset applied)
    const visualStart = loopStartBar + dragOffset.start;
    const visualEnd = loopEndBar + dragOffset.end;

    const leftPos = visualStart * pixelsPerBar;
    const rightPos = visualEnd * pixelsPerBar;
    const width = rightPos - leftPos;

    // Shared pointer-down starter
    const startDrag = useCallback((clientX: number, mode: DragMode, e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStartRef.current = {
            x: clientX,
            originalStart: loopStartBar,
            originalEnd: loopEndBar,
        };
        setDragMode(mode);
    }, [loopStartBar, loopEndBar]);

    const handleLeftPointerDown = useCallback((e: React.PointerEvent) => {
        startDrag(e.clientX, 'left', e);
    }, [startDrag]);

    const handleRightPointerDown = useCallback((e: React.PointerEvent) => {
        startDrag(e.clientX, 'right', e);
    }, [startDrag]);

    const handleMiddlePointerDown = useCallback((e: React.PointerEvent) => {
        startDrag(e.clientX, 'move', e);
    }, [startDrag]);

    // Double-click / double-tap to toggle loop
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        toggleLoop();
    }, [toggleLoop]);

    // Double-tap handler for touch devices (pointer events don't fire dblclick reliably)
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (dragOffset.start === 0 && dragOffset.end === 0) {
            // No drag happened — check for double-tap
            const now = Date.now();
            if (now - lastTapRef.current < 350) {
                // Double-tap detected
                e.stopPropagation();
                toggleLoop();
                lastTapRef.current = 0;
            } else {
                lastTapRef.current = now;
            }
        }
    }, [dragOffset, toggleLoop]);

    // Global pointer move/up for drag
    useEffect(() => {
        if (!dragMode) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (!dragStartRef.current) return;

            const deltaX = e.clientX - dragStartRef.current.x;
            const deltaBars = deltaX / pixelsPerBar;
            const snappedDelta = Math.round(deltaBars); // Snap to bars

            if (dragMode === 'left') {
                const maxDelta = dragStartRef.current.originalEnd - dragStartRef.current.originalStart - MIN_LOOP_BARS;
                const minDelta = -dragStartRef.current.originalStart;
                const clampedDelta = Math.max(minDelta, Math.min(maxDelta, snappedDelta));
                setDragOffset({ start: clampedDelta, end: 0 });
            } else if (dragMode === 'right') {
                const minDelta = MIN_LOOP_BARS - (dragStartRef.current.originalEnd - dragStartRef.current.originalStart);
                const clampedDelta = Math.max(minDelta, snappedDelta);
                setDragOffset({ start: 0, end: clampedDelta });
            } else if (dragMode === 'move') {
                const minDelta = -dragStartRef.current.originalStart;
                const clampedDelta = Math.max(minDelta, snappedDelta);
                setDragOffset({ start: clampedDelta, end: clampedDelta });
            }
        };

        const handlePointerUpGlobal = () => {
            if (dragStartRef.current) {
                if (dragOffset.start !== 0 || dragOffset.end !== 0) {
                    const newStart = Math.max(0, dragStartRef.current.originalStart + dragOffset.start);
                    const newEnd = Math.max(newStart + MIN_LOOP_BARS, dragStartRef.current.originalEnd + dragOffset.end);
                    setLoopRegion(newStart, newEnd);
                }
            }

            dragStartRef.current = null;
            setDragMode(null);
            setDragOffset({ start: 0, end: 0 });
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUpGlobal);
        window.addEventListener('pointercancel', handlePointerUpGlobal);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUpGlobal);
            window.removeEventListener('pointercancel', handlePointerUpGlobal);
        };
    }, [dragMode, dragOffset, pixelsPerBar, setLoopRegion]);

    const color = loopEnabled ? 'bg-yellow-500' : 'bg-gray-500';
    const regionColor = loopEnabled ? 'bg-yellow-500/30' : 'bg-gray-500/20';

    return (
        <div
            className="absolute top-0 pointer-events-none"
            style={{
                left: leftPos,
                width: Math.max(width, HANDLE_WIDTH * 2),
                height: rulerHeight,
                zIndex: 15,
            }}
        >
            {/* Loop region background — drag to move, double-tap/click to toggle */}
            <div
                className={`absolute inset-0 pointer-events-auto touch-none select-none ${regionColor} ${dragMode === 'move' ? 'cursor-grabbing' : 'cursor-grab'}`}
                onPointerDown={handleMiddlePointerDown}
                onPointerUp={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                title={loopEnabled ? 'Loop enabled (double-click to disable)' : 'Loop disabled (double-click to enable)'}
            />

            {/* Left bracket/handle */}
            <div
                className={`absolute left-0 top-0 bottom-0 pointer-events-auto touch-none select-none cursor-ew-resize flex items-center justify-center ${color}`}
                style={{ width: HANDLE_WIDTH }}
                onPointerDown={handleLeftPointerDown}
            >
                <div className="w-0.5 h-3 bg-white/70 rounded-full" />
            </div>

            {/* Right bracket/handle */}
            <div
                className={`absolute right-0 top-0 bottom-0 pointer-events-auto touch-none select-none cursor-ew-resize flex items-center justify-center ${color}`}
                style={{ width: HANDLE_WIDTH }}
                onPointerDown={handleRightPointerDown}
            >
                <div className="w-0.5 h-3 bg-white/70 rounded-full" />
            </div>

            {/* Loop region indicator line at bottom */}
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${color}`} />
        </div>
    );
}
