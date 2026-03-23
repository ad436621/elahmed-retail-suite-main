// ============================================================
// Shared Image Upload Component — Phase 3: Local File Storage
// When running in Electron, images are saved as .jpg files to
// userData/images/ via IPC, returning a file path string.
// In browser mode, falls back to compressed base64.
// ============================================================

import { useRef, useState } from 'react';
import { ImagePlus, ImageOff, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
    /** Current image — either a base64 data URL or a local path like "local-img://filename.jpg" */
    value?: string;
    /** Callback when the image changes (string for new image, undefined to clear). */
    onChange: (value: string | undefined) => void;
}

/** Resolve the display src from various image value formats */
function resolveImageSrc(value: string): string {
    // Local electron file path — served via custom protocol or as data URL
    if (value.startsWith('local-img://')) {
        // In Electron context, this won't work as is.
        // We use atom protocol or just use the path from userData
        // The main process should register a protocol for this
        return value; // handled by webContents.setWindowOpenHandler or protocol
    }
    return value; // base64 or plain http
}

/**
 * A reusable image upload component.
 * In Electron: uploads image to disk via IPC, stores the file path.
 * In browser: compresses to JPEG base64.
 */
export function ImageUpload({ value, onChange }: ImageUploadProps) {
    const ref = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);

        try {
            // Compress using canvas first
            const compressed = await compressImage(file, 800, 0.7);

            // If in Electron, save to disk; otherwise use base64
            if (window.electron?.ipcRenderer) {
                const result = await window.electron.ipcRenderer.invoke('save-image', compressed) as { success: boolean; path?: string; error?: string };
                if (result.success && result.path) {
                    onChange(result.path);
                } else {
                    console.error('Image save failed:', result.error);
                    // Fallback to base64 if save fails
                    onChange(compressed);
                }
            } else {
                onChange(compressed);
            }
        } catch (err) {
            console.error('Image upload error:', err);
        } finally {
            setIsUploading(false);
            if (ref.current) ref.current.value = '';
        }
    };

    const displaySrc = value ? resolveImageSrc(value) : undefined;

    return (
        <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ImagePlus className="h-3.5 w-3.5 text-primary" /> صورة المنتج
            </label>
            <div className="flex items-center gap-3">
                {/* Preview */}
                <div className="shrink-0">
                    {displaySrc ? (
                        <div className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-primary/40 shadow-sm">
                            <img src={displaySrc} alt="معاينة" className="h-full w-full object-cover" />
                            <button
                                type="button"
                                onClick={() => onChange(undefined)}
                                className="absolute top-1.5 right-1.5 rounded-full bg-red-500/90 p-1 text-white shadow-sm hover:bg-red-600 transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border/60 bg-muted/40 flex flex-col items-center justify-center gap-1">
                            <ImageOff className="h-6 w-6 text-muted-foreground/30" />
                            <span className="text-[10px] text-muted-foreground/50">لا صورة</span>
                        </div>
                    )}
                </div>

                {/* Upload button */}
                <div className="flex-1 flex flex-col justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => ref.current?.click()}
                        disabled={isUploading}
                        className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-2 text-xs font-medium text-primary hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                        {isUploading ? 'جاري الحفظ...' : (displaySrc ? 'تغيير الصورة' : 'اختر صورة')}
                    </button>
                    <p className="text-[10px] text-muted-foreground/50 text-center">JPG, PNG, WEBP — تُحفظ على الجهاز</p>
                </div>

                <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
        </div>
    );
}

// ─── Utilities ─────────────────────────────────────────────

function compressImage(file: File, maxDim = 800, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (ev) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                    else { w = Math.round(w * maxDim / h); h = maxDim; }
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = ev.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
