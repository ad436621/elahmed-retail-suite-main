// ============================================================
// useSoundFX — Web Audio API sound system (ported from ELOS)
// Usage: const { play } = useSoundFX();
//        play('add') | play('success') | play('error') | ...
// ============================================================

import { useCallback, useRef } from 'react';

export type SoundType =
    | 'add' | 'success' | 'save'
    | 'remove' | 'delete' | 'error'
    | 'scan' | 'click' | 'notify' | 'warning'
    | 'payment' | 'print' | 'refresh';

const SOUND_CONFIGS: Record<SoundType, { freq: number; duration: number; type: OscillatorType }> = {
    // Positive
    add: { freq: 800, duration: 0.08, type: 'sine' },
    success: { freq: 1200, duration: 0.15, type: 'sine' },
    save: { freq: 900, duration: 0.12, type: 'sine' },
    // Negative
    remove: { freq: 400, duration: 0.12, type: 'triangle' },
    delete: { freq: 300, duration: 0.15, type: 'triangle' },
    error: { freq: 200, duration: 0.25, type: 'square' },
    // Informational
    scan: { freq: 1000, duration: 0.04, type: 'sine' },
    click: { freq: 600, duration: 0.05, type: 'sine' },
    notify: { freq: 700, duration: 0.10, type: 'sine' },
    warning: { freq: 500, duration: 0.20, type: 'triangle' },
    // Special
    payment: { freq: 1100, duration: 0.20, type: 'sine' },
    print: { freq: 650, duration: 0.08, type: 'sine' },
    refresh: { freq: 550, duration: 0.10, type: 'triangle' },
};

export function useSoundFX() {
    const ctxRef = useRef<AudioContext | null>(null);

    const isEnabled = (): boolean =>
        localStorage.getItem('app_sounds') !== 'off';

    const getCtx = (): AudioContext => {
        if (!ctxRef.current) {
            ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        return ctxRef.current;
    };

    const play = useCallback((type: SoundType) => {
        if (!isEnabled()) return;
        try {
            const ctx = getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const cfg = SOUND_CONFIGS[type] ?? SOUND_CONFIGS.click;
            osc.frequency.value = cfg.freq;
            osc.type = cfg.type;
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + cfg.duration);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + cfg.duration);
        } catch {
            // Web Audio not supported — fail silently
        }
    }, []);

    const toggle = useCallback((): boolean => {
        const next = !isEnabled();
        localStorage.setItem('app_sounds', next ? 'on' : 'off');
        return next;
    }, []);

    const enable = useCallback(() => localStorage.setItem('app_sounds', 'on'), []);
    const disable = useCallback(() => localStorage.setItem('app_sounds', 'off'), []);

    return { play, toggle, enable, disable, enabled: isEnabled() };
}
