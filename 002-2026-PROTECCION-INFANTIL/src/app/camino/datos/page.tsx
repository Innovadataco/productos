"use client";

/**
 * SPEC-339 (A-67 §2.3) — Paso 2 de 4: tus datos.
 *
 * Reusa el formulario del perfil en variante "camino": los 7 campos que fijó
 * Jelkin (documento incluido), sin fecha de nacimiento (D-2). Al guardar, la
 * ruta re-sella la cookie y este cliente avanza al Paso 3.
 */
import { useRouter } from "next/navigation";
import { PerfilPadreForm } from "@/components/modules/padre/PerfilPadreForm";
import { destinoDePaso } from "@/lib/camino/pasos";

export default function CaminoDatosPage() {
    const router = useRouter();
    return (
        <div className="animate-fadeIn">
            <h1 className="font-serif text-2xl text-body">Cuéntanos de ti</h1>
            <p className="mb-5 mt-1 text-sm text-muted">
                Con estos datos podemos avisarte, y tu expediente tiene validez si algún día lo necesitas.
            </p>
            <PerfilPadreForm variante="camino" onGuardado={() => router.push(destinoDePaso("hijos"))} />
        </div>
    );
}
