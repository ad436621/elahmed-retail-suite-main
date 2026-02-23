import { useMemo } from 'react';

interface BarcodeSVGProps {
    value: string;
    width?: number;
    height?: number;
}

/**
 * Pure SVG barcode renderer — no external libraries needed.
 * Generates a Code128-style visual barcode from any string.
 */
export function BarcodeSVG({ value, width = 140, height = 36 }: BarcodeSVGProps) {
    const bars = useMemo(() => {
        if (!value) return [];

        // Generate a deterministic pattern from the string
        const result: { x: number; w: number }[] = [];
        const totalChars = value.length;
        const barAreaWidth = width - 10; // leave 5px padding each side

        // Create binary pattern from character codes
        const pattern: number[] = [];
        // Start pattern
        pattern.push(2, 1, 1, 2, 1, 1);

        for (let i = 0; i < totalChars; i++) {
            const code = value.charCodeAt(i);
            // Generate 6-bar groups per character
            pattern.push(
                ((code >> 0) & 3) + 1,
                ((code >> 2) & 1) + 1,
                ((code >> 3) & 3) + 1,
                ((code >> 5) & 1) + 1,
                ((code >> 1) & 3) + 1,
                ((code >> 4) & 1) + 1,
            );
        }

        // Stop pattern
        pattern.push(2, 1, 1, 1, 2, 1, 2);

        // Calculate total units
        const totalUnits = pattern.reduce((sum, p) => sum + p, 0);
        const unitWidth = barAreaWidth / totalUnits;

        let x = 5; // start padding
        pattern.forEach((units, idx) => {
            if (idx % 2 === 0) {
                // Even indices = black bars
                result.push({ x, w: Math.max(units * unitWidth, 0.5) });
            }
            x += units * unitWidth;
        });

        return result;
    }, [value, width]);

    if (!value) return null;

    return (
        <div className="inline-flex flex-col items-center gap-0.5">
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="block"
            >
                {bars.map((bar, i) => (
                    <rect
                        key={i}
                        x={bar.x}
                        y={0}
                        width={bar.w}
                        height={height - 10}
                        fill="currentColor"
                        className="text-card-foreground"
                    />
                ))}
                <text
                    x={width / 2}
                    y={height - 1}
                    textAnchor="middle"
                    fontSize="8"
                    fill="currentColor"
                    className="text-muted-foreground"
                    fontFamily="monospace"
                >
                    {value}
                </text>
            </svg>
        </div>
    );
}
