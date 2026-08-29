import type { MensajeUsuario as Mensaje } from "@/lib/bi/tipos-ui";

export function MensajeUsuario({ mensaje }: { mensaje: Mensaje }) {
    return (
        <div className="flex justify-end" data-testid="msg-usuario">
            <div className="max-w-2xl rounded-2xl rounded-br-none bg-primary-600 px-4 py-2 text-sm text-white">
                {mensaje.texto}
            </div>
        </div>
    );
}
