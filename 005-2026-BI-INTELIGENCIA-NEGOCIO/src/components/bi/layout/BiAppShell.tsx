import { ReactNode } from "react";
import { BiSideNav } from "./BiSideNav";
import { CerrarSesion } from "@/components/bi/auth/CerrarSesion";

interface BiAppShellProps {
    children: ReactNode;
}

export function BiAppShell({ children }: BiAppShellProps) {
    return (
        <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
            <aside className="flex flex-col border-b border-slate-200 bg-white/80 md:border-b-0 md:border-r">
                <BiSideNav />
                <CerrarSesion className="mt-auto border-t border-slate-200 p-4" />
            </aside>
            <main className="p-6" data-testid="bi-shell-main">
                {children}
            </main>
        </div>
    );
}
