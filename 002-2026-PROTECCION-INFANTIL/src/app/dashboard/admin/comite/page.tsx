import { ComiteBandeja } from "@/components/modules/ComiteBandeja";
import { ComiteSubNav } from "./components/ComiteSubNav";

export default function ComitePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Comité de Validación</h1>
                <p className="text-sm text-muted">Casos escalados por los operadores para revisión especializada.</p>
            </div>
            <ComiteSubNav />
            <ComiteBandeja />
        </div>
    );
}
