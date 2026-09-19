// SPEC-317 (002-PI-217): la lógica del Círculo de Confianza vive en una sola fuente.
// SPEC-711: la ruta del PADRE la envuelve con la compuerta por rol —un rol que no es
// PARENT se va a SU área, no ve el cascarón del padre— y luego renderiza la página real.
import CirculoConfianzaPage from "@/app/dashboard/circulo-confianza/page";
import { exigirPadre } from "@/lib/padre/guardia-padre";

export default async function PadreCirculoConfianzaPage() {
    await exigirPadre();
    return <CirculoConfianzaPage />;
}
