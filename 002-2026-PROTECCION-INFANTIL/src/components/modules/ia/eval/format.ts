export function formatPct(n: number) {
    return `${(n * 100).toFixed(1)}%`;
}

export function formatMs(n: number) {
    return `${Math.round(n)}ms`;
}

export function formatDuration(ms: number) {
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return `${min}m ${rest}s`;
}

export function classForDelta(delta: number) {
    if (delta > 0.01) return "text-green-600 dark:text-green-400";
    if (delta < -0.01) return "text-red-600 dark:text-red-400";
    return "text-slate-500 dark:text-slate-400";
}
