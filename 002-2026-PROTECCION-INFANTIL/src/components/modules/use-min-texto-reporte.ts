import { useEffect, useState } from "react";

const MIN_POR_DEFECTO = 20;

/** Longitud mínima del texto del reporte desde ParametroSistema (spec 092-US5, ADR_004). */
export function useMinTextoReporte(): number {
    const [min, setMin] = useState(MIN_POR_DEFECTO);
    useEffect(() => {
        fetch("/api/config/parametros/publicos", { credentials: "include" })
            .then((r) => r.json())
            .then((data) => {
                const valor = data?.["reportes.spam.min_text_length"]?.valor;
                const n = parseInt(String(valor), 10);
                if (Number.isFinite(n) && n > 0) setMin(n);
            })
            .catch(() => setMin(MIN_POR_DEFECTO));
    }, []);
    return min;
}
