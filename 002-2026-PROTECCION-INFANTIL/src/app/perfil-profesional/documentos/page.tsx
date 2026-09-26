"use client";

/**
 * SPEC-740 · Paso 2 del asistente de registro del profesional: los Documentos.
 *
 * Extraído de la ficha monolítica (`/perfil-profesional/completar`) para el asistente
 * multi-paso. `DocumentosRequisitos` guarda cada archivo AL SUBIRLO (no hay estado
 * volátil que perder), así que «Siguiente» solo navega al paso 3 (Autorización) y
 * «Atrás» (del shell) vuelve a la Ficha sin borrar nada. El marco «Paso 2 de 3» lo pone
 * `WizardProfesionalShell`. Voz usted.
 */
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";
import { destinoDePasoProfesional } from "@/lib/camino/pasos-profesional";

export default function DocumentosProfesionalPage() {
    const router = useRouter();
    return (
        <div className="space-y-6">
            <header>
                <h1 className="font-serif text-3xl text-body">Sus documentos</h1>
                <p className="mt-2 text-sm text-muted">
                    Estos son los documentos que Innovadataco revisa antes de habilitar su perfil. Se
                    guardan cifrados y solo los abre quien revisa su solicitud. Cada archivo queda
                    guardado al subirlo: puede continuar y volver sin perder nada.
                </p>
            </header>

            <GlassCard>
                <DocumentosRequisitos />
            </GlassCard>

            <div className="flex justify-end">
                <Button
                    type="button"
                    onClick={() => router.push(destinoDePasoProfesional("autorizacion"))}
                >
                    Siguiente: autorización
                </Button>
            </div>
        </div>
    );
}
