import Topbar from "@/components/bi/Topbar";
import ChatBI from "@/components/bi/ChatBI";

/**
 * Chat NL→SQL (Fase 2): página server con el layout estándar del producto.
 * Toda la interactividad (historial, fetch al motor, sugerencias) vive en
 * el componente client ChatBI.
 */
export default function ChatPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Conversá con la" acento="operación" activo="chat" />
            <ChatBI />
        </main>
    );
}
