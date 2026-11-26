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
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { TipoDiario } from "@/ia/contrato";
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
  /** El último análisis que terminó (de cualquier tarea) y cómo; ausente en un servicio anterior. */
  readonly ultimo?: { readonly tarea: string; readonly estado: string } | null;
}

const esEstado = (v: unknown): v is EstadoServicio => {
  const e = v as Partial<EstadoServicio> | null;
  return typeof v === "object" && v !== null && typeof e?.reintentarEnS === "number" && (e.enCurso === null || typeof e.enCurso === "string") && (e.enEspera === null || typeof e.enEspera === "string") && esUltimo(e.ultimo);
};

const esUltimo = (v: unknown): boolean => {
  if (v === undefined || v === null) return true;
  const u = v as { readonly tarea?: unknown; readonly estado?: unknown };
  return typeof v === "object" && typeof u.tarea === "string" && typeof u.estado === "string";
};

/**
 * El texto fijo de cómo terminó el análisis de esta tarea: «Análisis listo.» si se publicó, el texto del fallo si terminó
 * con ERROR o DESCARTADO; null en lo demás (un rechazo o un fallo los dice la tarjeta al refrescar) o si es de otra tarea.
 */
function textoDeTermino(ultimo: EstadoServicio["ultimo"], tarea: string): string | null {
  if (ultimo === undefined || ultimo === null || ultimo.tarea !== tarea) return null;
  if (ultimo.estado === "PUBLICADO") return T.listo;
  if (ultimo.estado === "ERROR") return T.analisisError;
  return ultimo.estado === "DESCARTADO" ? T.analisisDescartado : null;
}

/** La lectura del estado: `{ok:false}` si la red falla, el servicio no responde bien o el cuerpo no cuadra (nunca se confunde con un estado). */
type Lectura = { readonly ok: true; readonly estado: EstadoServicio } | { readonly ok: false };
const FALLA: Lectura = Object.freeze({ ok: false });
/** Cuántas lecturas fallidas seguidas, mientras se analiza, hacen que el botón avise y vuelva a quedar libre. */
const FALLAS_SEGUIDAS = 2;

async function leerEstado(signal: AbortSignal): Promise<Lectura> {
  try {
    const r = await fetch(RUTA, { cache: "no-store", signal });
    if (!r.ok) return FALLA;
    const cuerpo = (await r.json()) as { readonly estado?: unknown };
    return esEstado(cuerpo.estado) ? { ok: true, estado: cuerpo.estado } : FALLA;
  } catch {
    return FALLA;
  }
}

/** El texto fijo de un pedido que no se aceptó, según el estado HTTP y el código (la espera mínima, con sus segundos, se atiende antes). */
function textoDeRechazo(estado: number, codigo: unknown): string {
  if (codigo === "OCUPADO") return T.ocupado;
  if (codigo === "ANALISIS_APAGADO") return T.apagado;
  if (codigo === "TAREA_INACTIVA") return T.tareaInactiva;
  if (codigo === "SERVICIO_NO_DISPONIBLE" || codigo === "RESPUESTA_INVALIDA") return T.sinServicio;
  return estado === 429 ? T.demasiado : T.error;
}

export function BotonAnalizar({ tarea }: { readonly tarea: TipoDiario }) {
  const router = useRouter();
  const idEstado = useId();
  // El router se lee por una ref: así los efectos no se rearman si su identidad cambia.
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);
  const montado = useRef(false);
  const enviando = useRef(false);
  const pidio = useRef(false);
  const [fase, setFase] = useState<Fase>("libre");
  const [bloqueado, setBloqueado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const faseRef = useRef<Fase>("libre");
  const sondeos = useRef(0);
  const fallas = useRef(0);
  const desbloqueo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poner = useCallback((f: Fase) => {
    faseRef.current = f;
    setFase(f);
  }, []);

  const bloquear = useCallback((segundos: number, antes = "") => {
    if (!montado.current) return; // sin pantalla no hay temporizador que dejar
    if (desbloqueo.current !== null) clearTimeout(desbloqueo.current);
    setBloqueado(true);
    setMensaje(antes === "" ? textoEspera(segundos) : `${antes} ${textoEspera(segundos)}`);
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
    // Cómo terminó el propio se dice (la espera mínima, a continuación); uno ya viejo al cargar la página no.
    const termino = terminoElMio ? textoDeTermino(e.ultimo, tarea) : null;
    if (e.reintentarEnS > 0) bloquear(e.reintentarEnS, termino ?? "");
    else setMensaje(termino ?? "");
    if (terminoElMio) routerRef.current.refresh();
  }, [tarea, poner, bloquear]);

  // Mientras la pantalla está montada, se pueden poner temporizadores; al desmontar se suelta el de la espera.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      if (desbloqueo.current !== null) clearTimeout(desbloqueo.current);
      desbloqueo.current = null;
    };
  }, []);

  // Al cargar: ¿ya hay un análisis en curso, o la espera mínima vigente?
  useEffect(() => {
    let vivo = true;
    const control = new AbortController();
    void leerEstado(control.signal).then((e) => {
      // Si ya hizo clic mientras tanto, esa lectura es más vieja que lo que ve: no la pisa.
      if (vivo && e.ok && !pidio.current) aplicar(e.estado);
    });
    return () => {
      vivo = false;
      control.abort();
    };
  }, [aplicar]);

  // Mientras se analiza (o espera su turno): sondeo corto del estado.
  useEffect(() => {
    if (fase === "libre") return undefined;
    let vivo = true;
    const control = new AbortController();
    fallas.current = 0;
    const reloj = setInterval(() => {
      sondeos.current += 1;
      if (sondeos.current > MAX_SONDEOS) {
        poner("libre");
        setMensaje(T.sigueEnCurso);
        sondeos.current = 0;
        routerRef.current.refresh();
        return;
      }
      void leerEstado(control.signal).then((e) => {
        // Una respuesta tardía de un sondeo que ya se cerró (terminó, cambió la fase o se desmontó) no se aplica.
        if (!vivo) return;
        if (e.ok) {
          fallas.current = 0;
          aplicar(e.estado);
          return;
        }
        fallas.current += 1;
        if (fallas.current >= FALLAS_SEGUIDAS) {
          fallas.current = 0;
          sondeos.current = 0;
          poner("libre");
          setMensaje(T.sinEstado);
        }
      });
    }, SONDEO_MS);
    return () => {
      vivo = false;
      clearInterval(reloj);
      control.abort();
    };
  }, [fase, aplicar, poner]);

  async function pedir(): Promise<void> {
    // `enviando` cubre el hueco entre el clic y la respuesta: dos clics seguidos mandan un solo pedido.
    if (faseRef.current !== "libre" || bloqueado || enviando.current) return;
    enviando.current = true;
    try {
      await enviar();
    } finally {
      enviando.current = false;
    }
  }

  async function enviar(): Promise<void> {
    pidio.current = true;
    setMensaje("");
    let respuesta: Response;
    try {
      respuesta = await fetch(RUTA, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tarea }) });
    } catch {
      if (montado.current) setMensaje(T.error);
      return;
    }
    const cuerpo = (await respuesta.json().catch(() => null)) as { readonly lugar?: unknown; readonly codigo?: unknown; readonly reintentarEnS?: unknown } | null;
    if (!montado.current) return; // la pantalla ya no está: nada que mostrar ni temporizador que poner
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
      {/* aria-disabled y no disabled: el botón no pierde el foco al empezar el análisis; pedir() ya ignora el clic. */}
      <button type="button" className="resumen-ia-analizar" aria-disabled={ocupado || bloqueado} aria-describedby={idEstado} onClick={() => void pedir()}>
        {T.etiqueta}
      </button>
      <p id={idEstado} className="resumen-ia-analizar-estado" role="status" aria-live="polite">{mensaje}</p>
    </div>
  );
}
