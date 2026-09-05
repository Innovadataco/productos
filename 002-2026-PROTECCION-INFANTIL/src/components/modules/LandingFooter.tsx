import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export function LandingFooter() {
    return (
        <footer className="mt-12 border-t border-tinta/10 py-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-xs text-subtle">
                    © 2026 Innovadataco. Todos los derechos reservados. · Versión {APP_VERSION}
                </p>
                <nav className="flex gap-4 text-xs text-subtle">
                    <Link href="/privacidad" className="hover:text-body transition">
                        Privacidad
                    </Link>
                    <Link href="/terminos" className="hover:text-body transition">
                        Términos
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
