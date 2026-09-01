import Link from "next/link";
import BotonSalir from "./BotonSalir";

/**
 * Cabecera del producto (mockup-bi-v2). SE4: "Salir" siempre alcanzable
 * desde cualquier pantalla autenticada.
 */
export default function Topbar({
    titulo,
    acento,
    activo,
}: {
    titulo: string;
    acento: string;
    activo: "dashboard" | "chat" | "operacion";
}) {
    const tabs = [
        { id: "dashboard", href: "/dashboard", etiqueta: "Pulso" },
        { id: "chat", href: "/chat", etiqueta: "Chat IA" },
        { id: "operacion", href: "/operacion", etiqueta: "Operación" },
    ] as const;

    return (
        <header className="anim-entrada flex items-center gap-3.5 mb-7 flex-wrap">
            <div
                className="accent-gradient respira grid place-items-center rounded-[13px] font-bold text-[15px] text-[#060b0a]"
                style={{ width: 40, height: 40, boxShadow: "0 0 24px rgb(var(--pino-rgb) / 0.45)" }}
            >
                BI
            </div>
            <div>
                <h1 className="text-xl font-semibold tracking-tight">
                    {titulo} <span className="font-serif italic text-gradient">{acento}</span>
                </h1>
                <div className="text-muted text-[13px]">Inteligencia de negocio sobre PI</div>
            </div>
            <nav className="flex gap-1 ml-auto items-center">
                {tabs.map((t) => (
                    <Link
                        key={t.id}
                        href={t.href}
                        className={
                            activo === t.id
                                ? "px-4 py-2 rounded-full text-sm font-semibold text-estado-pino bg-[rgb(var(--pino-rgb)/0.14)]"
                                : "px-4 py-2 rounded-full text-sm text-muted transition-all hover:bg-[rgb(var(--tinta-rgb)/0.06)]"
                        }
                    >
                        {t.etiqueta}
                    </Link>
                ))}
                <BotonSalir />
            </nav>
        </header>
    );
}
