import { RelojColombia } from "./RelojColombia";
import { mostrar } from "@/lib/bi/operacion";

interface Props {
    titulo?: string | null;
    actualizado?: string | null;
    commit?: string | null;
}

const TITULO_DEFAULT = "Operación · Protección Infantil";

export function BarraOperacion({ titulo, actualizado, commit }: Props) {
    return (
        <div className="bar">
            <h1>{titulo && titulo.trim() ? titulo : TITULO_DEFAULT}</h1>
            <div className="clock">
                <span>
                    Colombia <RelojColombia />
                </span>
                <span>
                    Actualizado <b>{mostrar(actualizado)}</b>
                </span>
                <span>
                    Prod <b>{mostrar(commit)}</b>
                </span>
            </div>
        </div>
    );
}
