"use client";

/**
 * SPEC-339 (A-67 §2.4) — Paso 3 de 4: ¿a quién vas a cuidar?
 *
 * Reusa el módulo de menores completo (alta con documento, cuentas opcionales,
 * tope del parámetro). El «Siguiente» se enciende con el primer menor ACTIVO —
 * la misma condición que el guardián deriva (FR-018).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MisHijos } from "@/components/modules/padre/MisHijos";
import { Button } from "@/components/ui/Button";
import { destinoDePaso } from "@/lib/camino/pasos";

export default function CaminoHijosPage() {
    const router = useRouter();
    const [activos, setActivos] = useState(0);

    return (
        <div className="animate-fadeIn">
            <h1 className="font-serif text-2xl text-body">¿A quién vas a cuidar?</h1>
            <p className="mb-5 mt-1 text-sm text-muted">
                Tus hijos, o los menores de tu familia. Si conoces sus cuentas —su Roblox, su TikTok,
                un teléfono— súmalas; es opcional y puedes hacerlo después.
            </p>

            <MisHijos onListaCambio={setActivos} />

            <div className="mt-6">
                <Button
                    className="w-full"
                    disabled={activos === 0}
                    onClick={() => router.push(destinoDePaso("plan"))}
                >
                    Siguiente: tu plan
                </Button>
                {activos === 0 && (
                    <p className="mt-2 text-center text-sm text-muted">
                        Registra al menos un menor para continuar.
                    </p>
                )}
            </div>
        </div>
    );
}
