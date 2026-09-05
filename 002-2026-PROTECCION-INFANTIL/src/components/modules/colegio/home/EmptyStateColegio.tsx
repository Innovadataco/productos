import Link from "next/link";

/**
 * SPEC-143 (US4, FR-009) — Empty state del colegio sin cursos (mockup §5.2 del
 * brief): hero (escudo + sparkles, SVG custom — uno de los 3 momentos hero
 * permitidos por §4.4), celebración "Su colegio está listo para empezar", CTA
 * gigante "Crear primer curso" y la vía alternativa "¿Ya tienes tu lista en
 * Excel?". La interfaz nunca muestra vacío: muestra el primer paso.
 */

function HeroEscudoSparkles() {
    return (
        <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            role="img"
            aria-label="Escudo de protección con destellos"
            className="anim-entrada"
        >
            {/* Escudo (misma forma del centro del Anillo, escala hero) */}
            <path
                d="M 60 22 l 26 10.4 v 16.6 c 0 17.6 -11 28.6 -26 35 c -15 -6.4 -26 -17.4 -26 -35 v -16.6 Z"
                className="fill-pino"
            />
            {/* Sparkles */}
            <path
                d="M 24 30 l 2.2 5.8 5.8 2.2 -5.8 2.2 -2.2 5.8 -2.2 -5.8 -5.8 -2.2 5.8 -2.2 Z"
                className="fill-cielo"
            />
            <path
                d="M 96 62 l 1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 Z"
                className="fill-ambar"
            />
            <circle cx="98" cy="26" r="3" className="fill-cielo" />
        </svg>
    );
}

interface EmptyStateColegioProps {
    colegioNombre: string;
    className?: string;
}

export function EmptyStateColegio({ colegioNombre, className = "" }: EmptyStateColegioProps) {
    return (
        <main className={`min-h-screen p-4 sm:p-6 lg:p-8 ${className}`}>
            <div className="mx-auto flex max-w-2xl flex-col items-center pt-10 text-center sm:pt-16">
                <p className="microetiqueta anim-entrada">{colegioNombre}</p>

                <div className="mt-8">
                    <HeroEscudoSparkles />
                </div>

                <h1 className="titular-h1 anim-entrada mt-6 text-body" style={{ "--anim-retardo": "70ms" } as React.CSSProperties}>
                    Su colegio está listo para empezar
                </h1>
                <p className="cuerpo anim-entrada mt-3 text-muted" style={{ "--anim-retardo": "140ms" } as React.CSSProperties}>
                    Comencemos creando su primer curso.
                </p>

                <Link
                    href="/dashboard/colegio/cursos/unificado"
                    className="anim-entrada mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl accent-gradient px-10 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
                    style={{ "--anim-retardo": "210ms" } as React.CSSProperties}
                >
                    Crear primer curso →
                </Link>

                <p className="anim-entrada mt-8 text-sm text-muted" style={{ "--anim-retardo": "280ms" } as React.CSSProperties}>
                    ¿Ya tiene su lista en Excel?
                </p>
                <Link
                    href="/dashboard/colegio/cursos/unificado?modo=excel"
                    className="anim-entrada mt-2 inline-flex min-h-12 items-center rounded-xl px-4 py-2 text-sm font-semibold text-accent transition hover:underline"
                    style={{ "--anim-retardo": "280ms" } as React.CSSProperties}
                >
                    Subirla y creamos todo por ti →
                </Link>
            </div>
        </main>
    );
}
