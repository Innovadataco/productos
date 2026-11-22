"use client";
/**
 * El formulario de la versión nueva del plan (fase B, área de edición): precarga la versión base y deja cambiar la
 * fecha, el motivo y cada regla, agregar y quitar reglas. Envía a POST /api/plan/versiones lo que el dueño escribió
 * (el servidor lo lee como la ficha y lo valida con las reglas del importador), con la última versión que vio. Con
 * 201 va a la versión nueva; con error, el resumen toma el foco y cada campo queda marcado.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BotonEnviar, Campo, ResumenErrores, describir, useEnvio } from "../campos";
import { irA } from "../enviar";
import { ETIQUETAS_CAMPO, TEXTOS_PLAN, fecha } from "../textos";
import type { DatosEdicionPlan, ReglaEditable, VersionResumen } from "../tipos";
import { FilaRegla } from "./FilaRegla";

type Fila = ReglaEditable & { readonly clave: number };

const REGLA_NUEVA: ReglaEditable = { instrumentoId: null, condicion: "NINGUNA", nivel: "", accion: "NO_ACTUAR", cantidad: "", plazoHasta: "", detalle: "" };
const TIPO: Readonly<Record<VersionResumen["tipo"], string>> = { VIGENTE: "vigente", PROGRAMADA: "programada", HISTORICA: "histórica" };

function Avisos({ datos, vigenteDesde }: { readonly datos: DatosEdicionPlan; readonly vigenteDesde: string }) {
  const { base, ultima } = datos;
  return (
    <>
      {base === null ? <p className="nota">{TEXTOS_PLAN.PRIMERA}</p> : null}
      {base && base.tipo !== "VIGENTE" ? <p className="nota aviso">{`Se precargó la versión ${base.numero} (${TIPO[base.tipo]}), no la vigente.`}</p> : null}
      {ultima && ultima.tipo === "PROGRAMADA" ? (
        <p className="nota aviso">{`La versión ${ultima.numero} está programada desde el ${fecha(ultima.desde)}: la nueva rige desde esa fecha o después y la reemplaza entera.`}</p>
      ) : null}
      {vigenteDesde !== "" && vigenteDesde < datos.hoy ? <p className="nota aviso edicion-aviso-fecha" role="status">{TEXTOS_PLAN.FECHA_PASADA}</p> : null}
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

export function FormularioPlan({ datos }: { readonly datos: DatosEdicionPlan }) {
  const siguiente = useRef(datos.reglas.length);
  const [vigenteDesde, setVigenteDesde] = useState(datos.vigenteDesde);
  const [motivo, setMotivo] = useState("");
  const [reglas, setReglas] = useState<readonly Fila[]>(() => datos.reglas.map((r, clave) => ({ ...r, clave })));
  const [enfocar, setEnfocar] = useState<number | null>(null);
  const especieNueva = useRef<HTMLSelectElement | null>(null);
  const envio = useEnvio("/api/plan/versiones");

  useEffect(() => {
    if (enfocar === null) return;
    especieNueva.current?.focus();
    setEnfocar(null);
  }, [enfocar]);

  const cambiar = (clave: number, cambio: Partial<ReglaEditable>) => setReglas((rs) => rs.map((r) => (r.clave === clave ? { ...r, ...cambio } : r)));
  const agregar = () => {
    const clave = siguiente.current;
    siguiente.current += 1;
    envio.limpiar();
    setReglas((rs) => [...rs, { ...REGLA_NUEVA, clave }]);
    setEnfocar(clave);
  };
  const quitar = (clave: number) => {
    envio.limpiar();
    setReglas((rs) => rs.filter((r) => r.clave !== clave));
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

  const errorDeRegla = (i: number) => (campo: keyof ReglaEditable) => envio.errorDe(`reglas[${i}].${campo}`);
  return (
    <form className="edicion-form" noValidate onSubmit={guardar} aria-describedby="t-intro">
      <p id="t-intro">{TEXTOS_PLAN.INTRO}</p>
      <Avisos datos={datos} vigenteDesde={vigenteDesde} />
      <OtrasVersiones datos={datos} />
      <ResumenErrores envio={envio} />
      <div className="edicion-rejilla edicion-cabeza">
        <Campo id="vigenteDesde" etiqueta={ETIQUETAS_CAMPO.vigenteDesde!} ayuda={TEXTOS_PLAN.AYUDA_VIGENCIA} error={envio.errorDe("vigenteDesde")}>
          <input id="vigenteDesde" type="date" required min={datos.ultima?.desde} value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} {...describir("vigenteDesde", true, envio.errorDe("vigenteDesde"))} />
        </Campo>
      </div>
      <Campo id="motivo" etiqueta="Motivo del cambio" error={envio.errorDe("motivo")}>
        <textarea id="motivo" rows={3} maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} {...describir("motivo", false, envio.errorDe("motivo"))} />
      </Campo>
      <section className="edicion-reglas" aria-labelledby="t-reglas">
        <h2 id="t-reglas">{`Reglas (${reglas.length})`}</h2>
        {envio.errorDe("reglas") ? <p className="edicion-error" id="reglas-error">{envio.errorDe("reglas")}</p> : null}
        {reglas.map((r, i) => (
          <FilaRegla
            key={r.clave}
            regla={r}
            clave={r.clave}
            numero={i + 1}
            especies={datos.especies}
            errorDe={errorDeRegla(i)}
            onCambio={(c) => cambiar(r.clave, c)}
            onQuitar={() => quitar(r.clave)}
            refEspecie={r.clave === enfocar ? especieNueva : undefined}
            vigenteDesde={vigenteDesde}
          />
        ))}
        <button type="button" className="edicion-agregar" onClick={agregar}>{TEXTOS_PLAN.AGREGAR}</button>
      </section>
      <BotonEnviar texto={TEXTOS_PLAN.BOTON} enviando={envio.enviando} estado={TEXTOS_PLAN.ENVIANDO} />
    </form>
  );
}
