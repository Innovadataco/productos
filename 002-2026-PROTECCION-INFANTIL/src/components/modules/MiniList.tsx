"use client";

export type MiniListItem = {
    label: string;
    count: number;
    badge?: string;
    badgeColor?: string;
};

export function MiniList({
    items,
    empty,
    maxItems = 8,
}: {
    items: MiniListItem[];
    empty: string;
    maxItems?: number;
}) {
    if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
    const max = Math.max(...items.map((i) => i.count), 1);
    return (
        <div className="space-y-3">
            {items.slice(0, maxItems).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-body">
                                {item.badge && (
                                    <span
                                        className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${item.badgeColor || "bg-sky-500"}`}
                                    />
                                )}
                                <span className="truncate">{item.label}</span>
                            </span>
                            <span className="ml-2 font-semibold text-body">{item.count}</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                                style={{ width: `${(item.count / max) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
