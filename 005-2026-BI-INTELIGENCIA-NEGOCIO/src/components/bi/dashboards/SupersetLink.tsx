/**
 * SPEC-028 · 5 botones link directo a dashboards Superset · sin iframe / sin SSO.
 * Cada botón abre en nueva pestaña. Si Superset está pausado el link igual se
 * muestra (dashboard no responde hoy, comportamiento aceptable · candado 9).
 */

const DASHBOARDS = [
    { slug: "ejecutivo", label: "Ejecutivo", icon: "📊" },
    { slug: "motor_ia", label: "Motor IA", icon: "🤖" },
    { slug: "comercial", label: "Comercial", icon: "💰" },
    { slug: "operativo", label: "Operativo", icon: "⚙️" },
    { slug: "salud", label: "Salud", icon: "💚" },
] as const;

interface Props {
    baseUrl?: string;
    className?: string;
}

export function SupersetLink({ baseUrl, className = "" }: Props) {
    const base = baseUrl || process.env.NEXT_PUBLIC_SUPERSET_PUBLIC_URL || "http://localhost:8088";
    const wrapper = `flex flex-wrap gap-2 ${className}`.trim();
    return (
        <div data-testid="superset-link" className={wrapper}>
            {DASHBOARDS.map((d) => (
                <a
                    key={d.slug}
                    data-testid={`superset-btn-${d.slug}`}
                    href={`${base}/superset/dashboard/${d.slug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                >
                    <span aria-hidden="true">{d.icon}</span>
                    <span>{d.label}</span>
                </a>
            ))}
        </div>
    );
}
