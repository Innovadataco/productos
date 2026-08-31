import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { PreferenciasNotificaciones } from "@/components/modules/perfil/PreferenciasNotificaciones";
import type { RolUsuario } from "@prisma/client";

const TEMA_POR_ROL: Record<
    RolUsuario,
    { titulo: string; subtitulo: string; barra: string; tema: string }
> = {
    PARENT: {
        titulo: "Preferencias de notificaciones",
        subtitulo: "Elige cómo quieres recibir avisos de tus reportes y suscripción.",
        barra: "bg-cielo-600",
        tema: "theme-padre",
    },
    SCHOOL_ADMIN: {
        titulo: "Preferencias de notificaciones",
        subtitulo: "Configura los avisos del colegio y del servicio.",
        barra: "bg-pino-600",
        tema: "theme-colegio",
    },
    COMITE_CONVIVENCIA: {
        titulo: "Preferencias de notificaciones",
        subtitulo: "Configura los avisos del comité de convivencia.",
        barra: "bg-pino-600",
        tema: "theme-colegio",
    },
    ADMIN: {
        titulo: "Preferencias de notificaciones",
        subtitulo: "Configura los avisos de la plataforma.",
        barra: "bg-ambar-600",
        tema: "theme-admin",
    },
    OPERADOR: {
        titulo: "Preferencias de notificaciones",
        subtitulo: "Configura los avisos de casos asignados.",
        barra: "bg-ambar-600",
        tema: "theme-admin",
    },
    COMITE_VALIDACION: {
        titulo: "Preferencias de notificaciones",
        subtitulo: "Configura los avisos del comité de validación.",
        barra: "bg-ambar-600",
        tema: "theme-admin",
    },
};

export default async function PerfilNotificacionesPage() {
    const user = await verifyAuth();
    if (!user) {
        redirect("/login");
    }

    const tema = TEMA_POR_ROL[user.rol];

    return (
        <main className={`min-h-screen bg-page px-4 py-8 sm:px-6 lg:px-8 ${tema.tema}`}>
            <div className="mx-auto max-w-3xl">
                <div className={`mb-6 h-1 w-16 rounded-full ${tema.barra}`} aria-hidden="true" />
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-body">{tema.titulo}</h1>
                    <p className="mt-1 text-sm text-muted">{tema.subtitulo}</p>
                </div>
                <PreferenciasNotificaciones rol={user.rol} correo={user.email} />
            </div>
        </main>
    );
}
