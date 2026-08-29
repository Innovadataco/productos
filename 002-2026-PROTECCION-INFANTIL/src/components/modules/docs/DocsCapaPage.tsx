/**
 * SPEC-017 — Vista de una capa del módulo de documentación (server component).
 * Lista los temas de la capa con sus documentos y, si hay `?doc=<ruta>` en la
 * query y pertenece a ESTA capa, renderiza el documento (allowlist del índice).
 */
import Link from "next/link";
import { INDICE_DOCS, capasVisibles, type CapaDocs } from "@/lib/docs/indice";
import { leerDocumento } from "@/lib/docs/documentos";
import { Markdown } from "@/lib/docs/markdown";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";

const RUTA_POR_CAPA: Record<CapaDocs, string> = {
    1: "/docs",
    2: "/docs/operar",
    3: "/docs/tecnico",
};

const NOMBRE_POR_CAPA: Record<CapaDocs, string> = {
    1: "Qué y por qué",
    2: "Cómo funciona",
    3: "Por dentro",
};

export async function DocsCapaPage({
    capa,
    rol,
    docRuta,
}: {
    capa: CapaDocs;
    rol: string | null;
    docRuta?: string | undefined;
}) {
    const temas = INDICE_DOCS.filter((t) => t.capa === capa);
    const visibles = capasVisibles(rol);
    const documento = docRuta ? await leerDocumento(docRuta) : null;
    const documentoDeEstaCapa = documento && documento.capa === capa ? documento : null;

    return (
        <main className="mx-auto max-w-4xl px-4 py-8">
            <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
                {([1, 2, 3] as CapaDocs[])
                    .filter((c) => visibles.includes(c))
                    .map((c) => (
                        <Link
                            key={c}
                            href={RUTA_POR_CAPA[c]}
                            className={`rounded-full px-3 py-1 ${
                                c === capa
                                    ? "bg-sky-600 text-white dark:bg-cyan-700"
                                    : "bg-slate-100 text-body hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                            }`}
                        >
                            {NOMBRE_POR_CAPA[c]}
                        </Link>
                    ))}
            </nav>

            {documentoDeEstaCapa ? (
                <article>
                    <p className="mb-2 text-sm text-muted">
                        <Link href={RUTA_POR_CAPA[capa]} className="text-sky-600 underline dark:text-cyan-400">
                            ← {NOMBRE_POR_CAPA[capa]}
                        </Link>
                    </p>
                    <h1 className="mb-1 text-2xl font-bold text-body">{documentoDeEstaCapa.titulo}</h1>
                    <p className="mb-6 text-xs text-subtle">
                        Fuente: <code>{documentoDeEstaCapa.ruta}</code>
                    </p>
                    <Markdown source={documentoDeEstaCapa.markdown} />
                </article>
            ) : (
                <div className="space-y-6">
                    <header>
                        <h1 className="text-2xl font-bold text-body">Documentación — {NOMBRE_POR_CAPA[capa]}</h1>
                        <p className="mt-1 text-sm text-muted">
                            {capa === 1 && "Para aliados, prensa e instituciones: qué es la plataforma y por qué existe."}
                            {capa === 2 && "Para usuarios de la plataforma: cómo funciona y cómo operar cada módulo."}
                            {capa === 3 && "Para equipo técnico y auditoría: arquitectura, despliegue y decisiones."}
                        </p>
                    </header>
                    {temas.map((tema) => (
                        <GlassCard key={tema.slug} className="p-5">
                            <h2 className="text-lg font-semibold text-body">{tema.titulo}</h2>
                            <p className="mt-1 text-sm text-muted">{tema.descripcion}</p>
                            <ul className="mt-3 space-y-1">
                                {tema.documentos.map((doc) => (
                                    <li key={doc.ruta}>
                                        <Link
                                            href={`${RUTA_POR_CAPA[capa]}?doc=${encodeURIComponent(doc.ruta)}`}
                                            className="text-sm text-sky-600 underline dark:text-cyan-400"
                                        >
                                            {doc.titulo}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </GlassCard>
                    ))}
                    <p className="text-xs text-subtle">
                        <Badge variant="neutral">Capa {capa}</Badge> El contenido se renderiza desde los archivos
                        Markdown del repositorio, sin copias.
                    </p>
                </div>
            )}
        </main>
    );
}
