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
        </main>
    );
}
