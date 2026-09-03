import Link from "next/link";
import Topbar from "@/components/bi/Topbar";
import ChatBI from "@/components/bi/ChatBI";

/**
 * Chat NL→SQL (Fase 2): página server con el layout estándar del producto.
 * Toda la interactividad (historial, fetch al motor, sugerencias) vive en
 * el componente client ChatBI. Bajo el Topbar, un puente visible a la
 * bitácora general (auditoría completa: consultas del chat + eventos).
 */
export default function ChatPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Conversá con la" acento="operación" activo="chat" />
            <p className="mb-4 text-[12.5px] text-muted">
                Auditoría completa de consultas e ingresos:{" "}
                <Link
                    href="/admin/bitacora"
                    className="underline underline-offset-2 transition-colors hover:text-[rgb(var(--pino-rgb))]"
                >
                    ver la bitácora de BI →
                </Link>
            </p>
            <ChatBI />
        </main>
    );
}
