import Link from "next/link";

export function LandingFooter() {
    return (
        <footer className="mt-12 border-t border-slate-200 py-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-xs text-slate-500">
                    © {new Date().getFullYear()} Protección Infantil. Todos los derechos reservados.
                </p>
                <nav className="flex gap-4 text-xs text-slate-500">
                    <Link href="/privacidad" className="hover:text-slate-800 transition">
                        Privacidad
                    </Link>
                    <Link href="/terminos" className="hover:text-slate-800 transition">
                        Términos
                    </Link>
                    <Link href="/reportar" className="hover:text-slate-800 transition">
                        Reportar
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
