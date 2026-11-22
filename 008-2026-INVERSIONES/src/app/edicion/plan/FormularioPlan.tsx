"use client";
/**
 * El formulario de la versión nueva del plan (fase B, área de edición): precarga la versión base y deja cambiar la
 * fecha, el motivo y cada regla, agregar y quitar reglas. Envía a POST /api/plan/versiones lo que el dueño escribió
 * (el servidor lo lee como la ficha y lo valida con las reglas del importador), con la última versión que vio. Con
 * 201 va a la versión nueva; con error, el resumen toma el foco y cada campo queda marcado.
 * Foco: al agregar, a la especie de la regla nueva; al quitar, a la regla que queda en su lugar (o a la anterior, o a
 * «Agregar» si no queda ninguna), y una región de estado lo anuncia.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AvisoObligatorios, BotonEnviar, Campo, ResumenErrores, describir, useEnvio } from "../campos";
import { irA } from "../enviar";
import { ETIQUETAS_CAMPO, TEXTOS_PLAN, fecha, mensajeDeError, textoReglaQuitada } from "../textos";
import type { DatosEdicionPlan, ReglaEditable, VersionResumen } from "../tipos";
import { FilaRegla, idDeControl, type ErroresRegla } from "./FilaRegla";

type Fila = ReglaEditable & { readonly clave: number };

const REGLA_NUEVA: ReglaEditable = { instrumentoId: null, condicion: "NINGUNA", nivel: "", accion: "NO_ACTUAR", cantidad: "", plazoHasta: "", detalle: "" };
const TIPO: Readonly<Record<VersionResumen["tipo"], string>> = { VIGENTE: "vigente", PROGRAMADA: "programada", HISTORICA: "histórica" };
const SIN_ERRORES: ErroresRegla = {};
const ID_AGREGAR = "edicion-agregar";
const CAMPO_DE_REGLA = /^reglas\[(\d+)\]\.(\w+)$/;

function Avisos({ datos }: { readonly datos: DatosEdicionPlan }) {
  const { base, ultima } = datos;
  return (
    <>
      {base === null ? <p className="nota">{TEXTOS_PLAN.PRIMERA}</p> : null}
      {base && base.tipo !== "VIGENTE" ? <p className="nota aviso">{`Se precargó la versión ${base.numero} (${TIPO[base.tipo]}), no la vigente.`}</p> : null}
      {ultima && ultima.tipo === "PROGRAMADA" ? (
        <p className="nota aviso">{`La versión ${ultima.numero} está programada desde el ${fecha(ultima.desde)}: la nueva rige desde esa fecha o después y la reemplaza entera.`}</p>
      ) : null}
    </>
  );
}

function OtrasVersiones({ datos }: { readonly datos: DatosEdicionPlan }) {
  const otras = datos.versiones.filter((v) => v.numero !== datos.base?.numero);
  if (otras.length === 0) return null;
  return (
    <nav className="edicion-versiones" aria-label="Partir de otra versión">
      <span className="nota">Partir de otra versión:</span>
      <ul className="versiones">
        {otras.map((v) => <li key={v.numero}><a href={`/edicion/plan?base=${v.numero}`}>{`Versión ${v.numero} · ${TIPO[v.tipo]}`}</a></li>)}
      </ul>
    </nav>
  );
}

/** El foco después de quitar la regla `i` de `antes`: la que queda en su lugar, la anterior o «Agregar». */
function focoTrasQuitar(antes: readonly Fila[], i: number): string {
  const queda = antes[i + 1] ?? antes[i - 1];
  return queda ? idDeControl(queda.clave, "instrumentoId") : ID_AGREGAR;
}

export function FormularioPlan({ datos }: { readonly datos: DatosEdicionPlan }) {
  const siguiente = useRef(datos.reglas.length);
  const [vigenteDesde, setVigenteDesde] = useState(datos.vigenteDesde);
  const [motivo, setMotivo] = useState("");
  const [reglas, setReglas] = useState<readonly Fila[]>(() => datos.reglas.map((r, clave) => ({ ...r, clave })));
  const [anuncio, setAnuncio] = useState("");
  const enfocar = useRef<string | null>(null);
  const actuales = useRef(reglas);
  const envio = useEnvio("/api/plan/versiones");
  const { limpiar } = envio;

  useEffect(() => {
    actuales.current = reglas;
    if (enfocar.current === null) return;
    document.getElementById(enfocar.current)?.focus();
    enfocar.current = null;
  }, [reglas]);

  const cambiar = useCallback((clave: number, cambio: Partial<ReglaEditable>) => setReglas((rs) => rs.map((r) => (r.clave === clave ? { ...r, ...cambio } : r))), []);
  const quitar = useCallback(
    (clave: number) => {
      const antes = actuales.current;
      const i = antes.findIndex((r) => r.clave === clave);
      if (i < 0) return;
      limpiar();
      enfocar.current = focoTrasQuitar(antes, i);
      setAnuncio(textoReglaQuitada(i + 1, antes.length - 1));
      setReglas(antes.filter((r) => r.clave !== clave));
    },
    [limpiar],
  );
  const agregar = () => {
    const clave = siguiente.current;
    siguiente.current += 1;
    limpiar();
    enfocar.current = idDeControl(clave, "instrumentoId");
    setAnuncio("");
    setReglas((rs) => [...rs, { ...REGLA_NUEVA, clave }]);
  };

  // Los errores de cada regla, estables entre pintadas (así las filas memorizadas no se vuelven a pintar).
  const estado = envio.estado;
  const erroresPorRegla = useMemo(() => {
    const porIndice = new Map<number, Record<string, string>>();
    if (estado.tipo !== "error") return porIndice;
    for (const c of estado.campos) {
      const m = CAMPO_DE_REGLA.exec(c.campo);
      if (!m) continue;
      const i = Number(m[1]);
      porIndice.set(i, { ...porIndice.get(i), [m[2]!]: mensajeDeError(c.codigo) });
    }
    return porIndice;
  }, [estado]);

  /** Dónde está el control de un campo del pedido (para los enlaces del resumen). */
  const idDe = (campo: string): string | undefined => {
    if (campo === "vigenteDesde" || campo === "motivo") return campo;
    if (campo === "reglas") return ID_AGREGAR;
    const m = CAMPO_DE_REGLA.exec(campo);
    const fila = m ? reglas[Number(m[1])] : undefined;
    return fila && m ? idDeControl(fila.clave, m[2] as keyof ReglaEditable) : undefined;
  };

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cuerpo = { vigenteDesde, motivo, versionBase: datos.ultima?.numero ?? 0, reglas: reglas.map(({ clave: _clave, ...r }) => r) };
    await envio.enviar<{ version?: unknown }>(cuerpo, (r) => {
      if (typeof r.version !== "number" || !Number.isInteger(r.version)) return false;
      irA(`/plan?version=${r.version}`);
      return true;
    });
  }

  const errorReglas = envio.errorDe("reglas");
  return (
    <form className="edicion-form" noValidate onSubmit={guardar} aria-describedby="edicion-intro edicion-obligatorios">
      <p id="edicion-intro">{TEXTOS_PLAN.INTRO}</p>
      <AvisoObligatorios />
      <Avisos datos={datos} />
      <OtrasVersiones datos={datos} />
      <ResumenErrores envio={envio} idDe={idDe} />
      <div className="edicion-rejilla edicion-cabeza">
        <Campo id="vigenteDesde" etiqueta={ETIQUETAS_CAMPO.vigenteDesde!} ayuda={TEXTOS_PLAN.AYUDA_VIGENCIA} error={envio.errorDe("vigenteDesde")}>
          <input id="vigenteDesde" type="date" required min={datos.ultima?.desde} value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} {...describir("vigenteDesde", true, envio.errorDe("vigenteDesde"))} />
        </Campo>
      </div>
      <p className="nota aviso edicion-aviso-fecha" role="status">{vigenteDesde !== "" && vigenteDesde < datos.hoy ? TEXTOS_PLAN.FECHA_PASADA : ""}</p>
      <Campo id="motivo" etiqueta="Motivo del cambio" error={envio.errorDe("motivo")}>
        <textarea id="motivo" rows={3} maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} {...describir("motivo", false, envio.errorDe("motivo"))} />
      </Campo>
      <section className="edicion-reglas" aria-labelledby="t-reglas">
        <h2 id="t-reglas">{`Reglas (${reglas.length})`}</h2>
        <p className="edicion-anuncio" role="status">{anuncio}</p>
        {reglas.map((r, i) => (
          <FilaRegla
            key={r.clave}
            regla={r}
            clave={r.clave}
            numero={i + 1}
            especies={datos.especies}
            errores={erroresPorRegla.get(i) ?? SIN_ERRORES}
            onCambio={cambiar}
            onQuitar={quitar}
            vigenteDesde={vigenteDesde}
          />
        ))}
        {errorReglas ? <p className="edicion-error" id="reglas-error">{errorReglas}</p> : null}
        <button type="button" id={ID_AGREGAR} className="edicion-agregar" onClick={agregar} aria-describedby={errorReglas ? "reglas-error" : undefined}>{TEXTOS_PLAN.AGREGAR}</button>
      </section>
      <BotonEnviar texto={TEXTOS_PLAN.BOTON} enviando={envio.enviando} estado={TEXTOS_PLAN.ENVIANDO} />
    </form>
  );
}
