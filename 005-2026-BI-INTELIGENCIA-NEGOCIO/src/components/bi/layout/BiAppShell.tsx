import { ReactNode } from "react";
import { BiSideNav } from "./BiSideNav";

interface BiAppShellProps {
    children: ReactNode;
}

export function BiAppShell({ children }: BiAppShellProps) {
    return (
        <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
            <aside className="border-b border-slate-200 bg-white/80 md:border-b-0 md:border-r">
                <BiSideNav />
            </aside>
            <main className="p-6" data-testid="bi-shell-main">
                {children}
            </main>
        </div>
    );
}
