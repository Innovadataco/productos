"use client";
/**
 * El botón «Analizar con IA» de la tarjeta de resumen: lo monta la tarjeta SOLO si quien mira es el dueño y el
 * interruptor de config_ia está encendido (leer.ts: `puedeAnalizar`); la familia no lo ve, y la ruta le responde 403 de
 * todos modos. Pide POST /api/ia/analizar con exactamente `{"tarea"}`; el servicio responde enseguida y la pantalla dice
 * «Analizando…» mientras sondea el estado (GET, cada SONDEO_MS) y, al terminar el de esta tarea, refresca los datos del
 * servidor (la tarjeta trae el análisis nuevo). Al cargar la página también lee el estado: un análisis en curso o la
 * espera mínima de 2 minutos se ven sin hacer clic. Los mensajes son textos fijos (textos.ts), nunca el texto del servidor:
 * ni códigos ni cifras. Sin recomendaciones: solo dice qué pasa con el pedido.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TipoResumen } from "@/ia/contrato";
import { TEXTOS_RESUMEN_IA, textoEspera } from "./textos";

/** Cada cuánto se lee el estado mientras se analiza. */
export const SONDEO_MS = 3000;
/** Un tope al sondeo (~6 min): más que 1 en curso y 1 en espera de 60 s con la espera mínima de por medio. */
const MAX_SONDEOS = 120;
const MS_POR_S = 1000;
const RUTA = "/api/ia/analizar";
const T = TEXTOS_RESUMEN_IA.boton;

type Fase = "libre" | "analizando" | "espera";
interface EstadoServicio {
  readonly enCurso: string | null;
  readonly enEspera: string | null;
  readonly reintentarEnS: number;
}

const esEstado = (v: unknown): v is EstadoServicio => {
  const e = v as Partial<EstadoServicio> | null;
  return typeof v === "object" && v !== null && typeof e?.reintentarEnS === "number" && (e.enCurso === null || typeof e.enCurso === "string") && (e.enEspera === null || typeof e.enEspera === "string");
};

async function leerEstado(): Promise<EstadoServicio | null> {
  try {
    const r = await fetch(RUTA, { cache: "no-store" });
    if (!r.ok) return null;
    const cuerpo = (await r.json()) as { readonly estado?: unknown };
    return esEstado(cuerpo.estado) ? cuerpo.estado : null;
  } catch {
    return null;
  }
}

/** El texto fijo de un pedido que no se aceptó, según el estado HTTP y el código; null si es una espera mínima (lleva los segundos). */
function textoDeRechazo(estado: number, codigo: unknown): string {
  if (codigo === "OCUPADO") return T.ocupado;
  if (codigo === "ANALISIS_APAGADO") return T.apagado;
  if (codigo === "TAREA_INACTIVA") return T.tareaInactiva;
  if (codigo === "SERVICIO_NO_DISPONIBLE" || codigo === "RESPUESTA_INVALIDA") return T.sinServicio;
  return estado === 429 ? T.demasiado : T.error;
}

export function BotonAnalizar({ tarea }: { readonly tarea: TipoResumen }) {
  const router = useRouter();
  // El router se lee por una ref: así los efectos no se rearman si su identidad cambia.
  const routerRef = useRef(router);
  routerRef.current = router;
  const pidio = useRef(false);
  const [fase, setFase] = useState<Fase>("libre");
  const [bloqueado, setBloqueado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const faseRef = useRef<Fase>("libre");
  const sondeos = useRef(0);
  const desbloqueo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poner = useCallback((f: Fase) => {
    faseRef.current = f;
    setFase(f);
  }, []);

  const bloquear = useCallback((segundos: number) => {
    if (desbloqueo.current !== null) clearTimeout(desbloqueo.current);
    setBloqueado(true);
    setMensaje(textoEspera(segundos));
    desbloqueo.current = setTimeout(() => {
      setBloqueado(false);
      setMensaje("");
      desbloqueo.current = null;
    }, Math.max(segundos, 1) * MS_POR_S);
  }, []);

  /** Lo que dice el estado del servicio sobre ESTA tarea; si terminó el análisis que esperábamos, refresca la pantalla. */
  const aplicar = useCallback((e: EstadoServicio) => {
    if (e.enCurso === tarea) {
      poner("analizando");
      setMensaje(T.analizando);
      return;
    }
    if (e.enEspera === tarea) {
      poner("espera");
      setMensaje(T.enEspera);
      return;
    }
    const terminoElMio = faseRef.current !== "libre";
    poner("libre");
    sondeos.current = 0;
    if (e.reintentarEnS > 0) bloquear(e.reintentarEnS);
    else setMensaje("");
    if (terminoElMio) routerRef.current.refresh();
  }, [tarea, poner, bloquear]);

  // Al cargar: ¿ya hay un análisis en curso, o la espera mínima vigente?
  useEffect(() => {
    let vivo = true;
    void leerEstado().then((e) => {
      // Si ya hizo clic mientras tanto, esa lectura es más vieja que lo que ve: no la pisa.
      if (vivo && e !== null && !pidio.current) aplicar(e);
    });
    return () => { vivo = false; };
  }, [aplicar]);

  // Mientras se analiza (o espera su turno): sondeo corto del estado.
  useEffect(() => {
    if (fase === "libre") return undefined;
    const reloj = setInterval(() => {
      sondeos.current += 1;
      if (sondeos.current > MAX_SONDEOS) {
        poner("libre");
        setMensaje("");
        sondeos.current = 0;
        routerRef.current.refresh();
        return;
      }
      void leerEstado().then((e) => {
        if (e !== null) aplicar(e);
      });
    }, SONDEO_MS);
    return () => clearInterval(reloj);
  }, [fase, aplicar, poner]);

  useEffect(() => () => { if (desbloqueo.current !== null) clearTimeout(desbloqueo.current); }, []);

  async function pedir(): Promise<void> {
    if (faseRef.current !== "libre" || bloqueado) return;
    pidio.current = true;
    setMensaje("");
    let respuesta: Response;
    try {
      respuesta = await fetch(RUTA, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tarea }) });
    } catch {
      setMensaje(T.error);
      return;
    }
    const cuerpo = (await respuesta.json().catch(() => null)) as { readonly lugar?: unknown; readonly codigo?: unknown; readonly reintentarEnS?: unknown } | null;
    if (respuesta.status === 202) {
      sondeos.current = 0;
      poner(cuerpo?.lugar === "EN_ESPERA" ? "espera" : "analizando");
      setMensaje(cuerpo?.lugar === "EN_ESPERA" ? T.enEspera : T.analizando);
      return;
    }
    if (cuerpo?.codigo === "ESPERA_MINIMA" && typeof cuerpo.reintentarEnS === "number") {
      bloquear(cuerpo.reintentarEnS);
      return;
    }
    setMensaje(textoDeRechazo(respuesta.status, cuerpo?.codigo));
  }

  const ocupado = fase !== "libre";
  return (
    <div className="resumen-ia-analizar-caja">
      <button type="button" className="resumen-ia-analizar" disabled={ocupado || bloqueado} aria-busy={ocupado ? true : undefined} onClick={() => void pedir()}>
        {T.etiqueta}
      </button>
      <p className="resumen-ia-analizar-estado" role="status" aria-live="polite">{mensaje}</p>
    </div>
  );
}
