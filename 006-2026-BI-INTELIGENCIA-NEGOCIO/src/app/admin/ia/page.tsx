import Link from "next/link";
import Topbar from "@/components/bi/Topbar";
import AdminIaPlayground from "@/components/bi/admin-ia/AdminIaPlayground";

/**
 * Página Admin IA (006): configuración del modelo de chat contra Ollama.
 * Réplica del flujo del playground de PI como sistema separado — auth propia
 * (middleware), config propia (bi_config) y API propia (/api/bi/ollama/*).
 */
export default function AdminIaPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Administrá el" acento="motor IA" activo="admin-ia" />
            <AdminIaPlayground />
            {/* Enlace discreto a la bitácora global del chat (Lote 3). */}
            <Link
                href="/admin/bitacora"
                className="glass anim-entrada mt-4 flex items-center justify-between gap-4 p-5 transition-colors hover:border-[rgb(var(--pino-rgb)/0.4)]"
            >
                <span className="text-muted text-[13px]">
                    Cada pregunta al motor queda registrada con su estado, latencia y traza.
                </span>
                <span className="text-sm font-medium text-estado-pino whitespace-nowrap">
                    Ver bitácora del chat →
                </span>
            </Link>
        </main>
    );
}
