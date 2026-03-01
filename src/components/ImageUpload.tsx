// ============================================================
// Shared Image Upload Component
// Used across Mobiles, Computers, Devices, Cars, & Used inventory pages
// ============================================================

import { useRef } from 'react';
import { ImagePlus, ImageOff, X } from 'lucide-react';

interface ImageUploadProps {
    /** Current base64 data URL or undefined. */
    value?: string;
    /** Callback when the image changes (string for new image, undefined to clear). */
    onChange: (value: string | undefined) => void;
}

/**
 * A reusable image upload field that shows a preview, allows uploading,
 * and optionally clearing the current image.
 */
export function ImageUpload({ value, onChange }: ImageUploadProps) {
    const ref = useRef<HTMLInputElement>(null);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => onChange(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    return (
        <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ImagePlus className="h-3.5 w-3.5 text-primary" /> صورة المنتج
            </label>
            <div className="flex items-center gap-3">
                {/* Preview */}
                <div className="shrink-0">
                    {value ? (
                        <div className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-primary/40 shadow-sm">
                            <img src={value} alt="معاينة" className="h-full w-full object-cover" />
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
                        className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-2 text-xs font-medium text-primary hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center justify-center gap-1.5"
                    >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {value ? 'تغيير الصورة' : 'اختر صورة'}
                    </button>
                    <p className="text-[10px] text-muted-foreground/50 text-center">JPG, PNG, WEBP</p>
                </div>

                <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
        </div>
    );
}
