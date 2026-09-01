/**
 * SPEC-346 (I-234 · recorrido en vivo 340) — página pública de verificación
 * del sello del PDF. El pie del PDF imprime `<baseUrl>/verificar/<codigo>` y
 * hasta ahora esa URL respondía 404. Una autoridad con el papel en la mano
 * ahora la abre y ve la evidencia sin necesidad de cuenta.
 */
import { buscarInformePadrePorCodigo } from "@/lib/dal/services/informes-padre";

export const dynamic = "force-dynamic";

function fechaBogota(f: Date | string): string {
    const d = typeof f === "string" ? new Date(f) : f;
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Bogota",
    }).format(d);
}

export default async function VerificarPage({
    params,
}: {
    params: Promise<{ codigo: string }>;
}) {
    const { codigo } = await params;
    const informe = codigo ? await buscarInformePadrePorCodigo(codigo) : null;

    return (
        <main className="mx-auto max-w-2xl px-4 py-12 text-body">
            <h1 className="text-2xl font-bold">Verificación del informe</h1>
            <p className="mt-2 text-sm text-muted">
                Esta página permite comprobar que un informe generado por PI existe
                en el sistema. Basta con el código impreso al pie del documento.
            </p>

            <section className="glass mt-6 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wide text-subtle">Código</p>
                <p className="mt-1 font-mono text-sm">{codigo}</p>

                {informe ? (
                    <div className="mt-4 space-y-2 text-sm">
                        <p className="text-pino font-semibold">Informe verificado</p>
                        <p>
                            <span className="text-subtle">Generado:</span>{" "}
                            <span className="font-medium">{fechaBogota(informe.generadoEn)}</span>
                        </p>
                        <p>
                            <span className="text-subtle">Número:</span>{" "}
                            <span className="font-medium">#{informe.numeroSecuencial}</span>
                        </p>
                        <p className="mt-3 text-xs text-muted">
                            Este documento fue generado por Protección Infantil el día indicado.
                            El contenido del expediente NO se publica: la autoridad debe pedirlo
                            por el canal legal correspondiente.
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 text-sm">
                        <p className="text-madera font-semibold">Código no encontrado</p>
                        <p className="mt-2 text-muted">
                            Revisa que hayas copiado exactamente el código impreso al pie del PDF.
                            Si sigue sin aparecer, es posible que el documento no haya sido emitido
                            por Protección Infantil.
                        </p>
                    </div>
                )}
            </section>
        </main>
    );
}
