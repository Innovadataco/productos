// SPEC-325 (002-PI-225) · "A quién protejo" — módulo de hijos/familiares del padre.
import { MisHijos } from "@/components/modules/padre/MisHijos";

export default function PadreHijosPage() {
    return (
        <div className="mx-auto w-full max-w-3xl p-4">
            <MisHijos />
        </div>
    );
}
