import { BannerEstado } from "./BannerEstado";
import { BotonesFeedback } from "./BotonesFeedback";
import { GraficoVegaLite } from "./GraficoVegaLite";
import { PanelDetalle } from "./PanelDetalle";
import { TablaBI } from "./TablaBI";
import type { MensajeMotor as Mensaje, UsuarioUI } from "@/lib/bi/tipos-ui";

interface Props {
    mensaje: Mensaje;
    usuario: UsuarioUI;
}

export function MensajeMotor({ mensaje, usuario }: Props) {
    const { respuesta } = mensaje;
    const filas = (respuesta.filas as Array<Record<string, unknown>> | undefined) ?? [];

    return (
        <div data-testid="msg-motor" className="max-w-2xl space-y-2 rounded-2xl rounded-bl-none bg-slate-100 p-3 text-sm text-slate-800">
            <BannerEstado respuesta={respuesta} />
            {respuesta.estado === "OK" && respuesta.plantilla === "sin-datos" && (
                <p data-testid="plantilla-sin-datos" className="text-slate-600">
                    {respuesta.respuestaNarrativa}
                </p>
            )}
            {respuesta.estado === "OK" && respuesta.plantilla === "un-numero" && (
                <div data-testid="plantilla-un-numero">
                    <div className="text-3xl font-bold text-primary-700">
                        {(filas[0] && Object.values(filas[0])[0]) as number | string}
                    </div>
                    <div className="text-xs text-slate-500">{respuesta.respuestaNarrativa}</div>
                </div>
            )}
            {respuesta.estado === "OK" && respuesta.plantilla === "tabla" && (
                <TablaBI filas={filas} />
            )}
            {respuesta.estado === "OK" && respuesta.plantilla === "grafico" && respuesta.graficoSpec && (
                <GraficoVegaLite spec={respuesta.graficoSpec} />
            )}
            <PanelDetalle respuesta={respuesta} />
            <BotonesFeedback usuario={usuario} consultaLogId={respuesta.consultaLogId} />
        </div>
    );
}
