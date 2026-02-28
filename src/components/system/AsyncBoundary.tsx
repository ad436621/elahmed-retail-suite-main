// ============================================================
// Async Boundary Component
// Unified Loading + Error States
// ============================================================

import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

interface AsyncBoundaryProps {
    children: ReactNode;
    isLoading?: boolean;
    loadingText?: string;
    error?: Error | null;
    onRetry?: () => void;
    skeleton?: ReactNode;
}

export function AsyncBoundary({
    children,
    isLoading,
    loadingText = 'جاري التحميل...',
    error,
    onRetry,
    skeleton,
}: AsyncBoundaryProps) {
    // Show skeleton if provided and loading
    if (isLoading && skeleton) {
        return <>{skeleton}</>;
    }

    // Show loading state
    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">{loadingText}</p>
                </CardContent>
            </Card>
        );
    }

    // Show error state
    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                    <h3 className="text-lg font-semibold mb-2">حدث خطأ</h3>
                    <p className="text-muted-foreground text-center mb-4">
                        {error.message || 'حدث خطأ غير متوقع'}
                    </p>
                    {onRetry && (
                        <Button onClick={onRetry} variant="outline">
                            <RefreshCw className="ml-2 h-4 w-4" />
                            إعادة المحاولة
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Show children
    return <>{children}</>;
}

// ============================================================
// Skeleton Loaders for Common Components
// ============================================================

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 rtl:space-x-reverse">
                    <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-1/6 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-1/6 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-1/6 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-1/6 bg-muted animate-pulse rounded" />
                </div>
            ))}
        </div>
    );
}

export function CardSkeleton() {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="h-8 w-24 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
        </Card>
    );
}

export function DetailSkeleton() {
    return (
        <Card>
            <CardContent className="pt-6 space-y-4">
                <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                <div className="space-y-2">
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================
// Page Loading Wrapper
// ============================================================

interface PageLoaderProps {
    isLoading: boolean;
    error?: Error | null;
    onRetry?: () => void;
    children: ReactNode;
}

export function PageLoader({ isLoading, error, onRetry, children }: PageLoaderProps) {
    return (
        <AsyncBoundary
            isLoading={isLoading}
            error={error}
            onRetry={onRetry}
            loadingText="جاري تحميل الصفحة..."
            skeleton={
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            }
        >
            {children}
        </AsyncBoundary>
    );
}
