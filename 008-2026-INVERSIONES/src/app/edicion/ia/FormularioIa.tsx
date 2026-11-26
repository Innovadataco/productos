"use client";
/**
 * El formulario de la configuración de la IA (E8). Precarga la vigente; el dueño cambia el modo, la dirección y el
 * puerto del Ollama, la temperatura de la local, el modelo local de cada tarea, el modelo, el esfuerzo y el tope de la
 * nube, la hora y el límite, con su motivo. Envía a POST /api/ia/config lo escrito con la última versión que vio (el
 * servidor lo lee y lo valida contra la lista de PI); con 201 recarga la página con la versión guardada; con error, el
 * resumen toma el foco y cada campo queda marcado. Un modelo local se elige solo si «Identificar modelos» lo encontró
 * instalado con el digest de la lista de PI (o si ya era el guardado de esa tarea).
 */
import { useState, type FormEvent } from "react";
import { BotonEnviar, useEnvio } from "../campos";
import { irA } from "../enviar";
import { ResumenIa, Seleccion, Texto } from "./CamposIa";
import { PanelOllama } from "./PanelOllama";
import { AVISOS_IA, ETIQUETAS_IA, TEXTOS_IA, mensajeIa } from "./textos-ia";
import type { ConfigEditable, DatosEdicionIa, ModeloIdentificadoVista, TareaEditable } from "./tipos-ia";

const ID_DE_CAMPO: Readonly<Record<string, string>> = {
  modo: "ia-modo", ollamaHost: "ia-host", ollamaPuerto: "ia-puerto", temperatura: "ia-temperatura", modeloNube: "ia-modelo-nube",
  esfuerzoNube: "ia-esfuerzo", topeMensualUsd: "ia-tope", horaResumen: "ia-hora", limiteSegundos: "ia-limite", analisisDemanda: "ia-analisis-demanda", motivo: "ia-motivo",
};
const CAMPO_DE_TAREA = /^tareas\.([A-Z]+)\.modeloLocal$/;
const idDeCampo = (campo: string): string | undefined => {
  const m = CAMPO_DE_TAREA.exec(campo);
  return m ? `ia-tarea-${m[1]}-modelo` : ID_DE_CAMPO[campo];
};

interface PropsTareas {
  readonly datos: DatosEdicionIa;
  readonly tareas: Readonly<Record<string, TareaEditable>>;
  readonly instalados: ReadonlySet<string> | null;
  readonly errorDe: (campo: string) => string | undefined;
  readonly onCambio: (tarea: string, cambio: Partial<TareaEditable>) => void;
}

/** Cada tarea: si está activa y su modelo local (de la lista de PI; seleccionable si está instalado con su digest). */
function Tareas({ datos, tareas, instalados, errorDe, onCambio }: PropsTareas) {
  const { modelosLocales } = datos.opciones;
  const sinLista = datos.listaPi.estado !== "LISTA";
  return (
    <fieldset className="edicion-regla">
      <legend>Tareas</legend>
      {sinLista ? <p className="nota aviso">{AVISOS_IA.SIN_LISTA}</p> : null}
      {datos.opciones.tareas.map((t) => {
        const valor = tareas[t.valor] ?? { activo: false, modeloLocal: "" };
        const guardado = datos.guardado.modelos[t.valor] ?? "";
        const opciones = [
          { valor: "", texto: TEXTOS_IA.SIN_MODELO },
          ...modelosLocales.map((m) => {
            const deshabilitada = !(instalados?.has(m.nombre) ?? false) && guardado !== m.nombre;
            const porQue = deshabilitada ? ` (${instalados === null ? AVISOS_IA.SIN_IDENTIFICAR : AVISOS_IA.NO_SELECCIONABLE})` : "";
            return { valor: m.nombre, texto: `${m.nombre}${m.recomendado ? ` (${TEXTOS_IA.RECOMENDADO})` : ""}${m.aviso32b ? ` · ${AVISOS_IA.RECARGA_32B}` : ""}${porQue}`, deshabilitada };
          }),
          // Lo guardado que ya no está en la lista se ve (y no se pierde en silencio), pero no se puede volver a elegir.
          ...(valor.modeloLocal !== "" && !modelosLocales.some((m) => m.nombre === valor.modeloLocal)
            ? [{ valor: valor.modeloLocal, texto: `${valor.modeloLocal} (${AVISOS_IA.YA_NO_EN_LISTA})`, deshabilitada: true }]
            : []),
        ];
        return (
          <div className="edicion-rejilla" key={t.valor}>
            <div className="edicion-campo edicion-casilla">
              <input id={`ia-tarea-${t.valor}-activo`} type="checkbox" checked={valor.activo} onChange={(e) => onCambio(t.valor, { activo: e.target.checked })} />
              <label htmlFor={`ia-tarea-${t.valor}-activo`}>{`${t.texto}: activa`}</label>
            </div>
            <Seleccion id={`ia-tarea-${t.valor}-modelo`} etiqueta={`${t.texto}: modelo local`} valor={valor.modeloLocal} opciones={opciones} deshabilitada={sinLista} ayuda={AVISOS_IA.AYUDA_MODELO}
              onCambio={(v) => onCambio(t.valor, { modeloLocal: v })} error={errorDe(`tareas.${t.valor}.modeloLocal`)} />
          </div>
        );
      })}
    </fieldset>
  );
}

export function FormularioIa({ datos }: { readonly datos: DatosEdicionIa }) {
  const [valores, setValores] = useState<ConfigEditable>(datos.inicial);
  const [motivo, setMotivo] = useState("");
  const [instalados, setInstalados] = useState<ReadonlySet<string> | null>(null);
  const envio = useEnvio("/api/ia/config");
  const { opciones } = datos;
  const estado = envio.estado;
  const campos = estado.tipo === "error" ? estado.campos : [];
  const errorDe = (campo: string): string | undefined => {
    const e = campos.find((c) => c.campo === campo);
    return e ? mensajeIa(e.codigo) : undefined;
  };
  const nombreTarea = (clave: string): string => opciones.tareas.find((t) => t.valor === clave)?.texto ?? clave;
  const cambiar = (cambio: Partial<ConfigEditable>) => setValores((v) => ({ ...v, ...cambio }));
  const cambiarTarea = (tarea: string, cambio: Partial<TareaEditable>) =>
    setValores((v) => ({ ...v, tareas: { ...v.tareas, [tarea]: { ...(v.tareas[tarea] ?? { activo: false, modeloLocal: "" }), ...cambio } } }));
  const alIdentificar = (modelos: readonly ModeloIdentificadoVista[]) => setInstalados(new Set(modelos.filter((m) => m.seleccionable).map((m) => m.nombre)));

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    await envio.enviar<{ version?: unknown }>({ versionBase: datos.versionBase, ...valores, motivo }, (r) => {
      if (typeof r.version !== "number" || !Number.isInteger(r.version)) return false;
      irA(`/edicion/ia?guardada=${r.version}`);
      return true;
    });
  }

  const temperaturaAlta = valores.temperatura.trim() !== "" && !/^0([.,]0{1,2})?$/.test(valores.temperatura.trim());
  const precio = opciones.modelosNube.find((m) => m.valor === valores.modeloNube)?.precio;
  return (
    <form className="edicion-form" noValidate onSubmit={guardar} aria-labelledby="t-formulario">
      <h2 id="t-formulario">Nueva versión de la configuración</h2>
      <p className="nota">{TEXTOS_IA.OBLIGATORIOS}</p>
      <ResumenIa referencia={envio.resumen} mensaje={estado.tipo === "error" ? estado.mensaje : null} campos={campos} idDe={idDeCampo} nombreTarea={nombreTarea} />
      <div className="edicion-rejilla">
        <Seleccion id="ia-modo" etiqueta={ETIQUETAS_IA.modo!} valor={valores.modo} opciones={opciones.modos} onCambio={(v) => cambiar({ modo: v })} error={errorDe("modo")} />
        <Seleccion id="ia-hora" etiqueta={ETIQUETAS_IA.horaResumen!} valor={valores.horaResumen} opciones={opciones.horas.map((h) => ({ valor: h, texto: `${h} (hora de Colombia)` }))} onCambio={(v) => cambiar({ horaResumen: v })} error={errorDe("horaResumen")} />
        <Texto id="ia-limite" modo="numeric" etiqueta={ETIQUETAS_IA.limiteSegundos!} valor={valores.limiteSegundos} ayuda={`De ${opciones.limites.limiteMin} a ${opciones.limites.limiteMax} (el límite de PI).`} onCambio={(v) => cambiar({ limiteSegundos: v })} error={errorDe("limiteSegundos")} />
      </div>
      <div className="edicion-campo edicion-casilla">
        <input id="ia-analisis-demanda" type="checkbox" checked={valores.analisisDemanda} onChange={(e) => cambiar({ analisisDemanda: e.target.checked })} aria-invalid={errorDe("analisisDemanda") ? true : undefined} aria-describedby={errorDe("analisisDemanda") ? "ia-analisis-demanda-ayuda ia-analisis-demanda-error" : "ia-analisis-demanda-ayuda"} />
        <label htmlFor="ia-analisis-demanda">{ETIQUETAS_IA.analisisDemanda}</label>
        <p className="edicion-ayuda" id="ia-analisis-demanda-ayuda">{TEXTOS_IA.AYUDA_ANALISIS}</p>
        {errorDe("analisisDemanda") ? <p className="edicion-error" id="ia-analisis-demanda-error">{errorDe("analisisDemanda")}</p> : null}
      </div>

      <fieldset className="edicion-regla" aria-describedby="ia-destino-aviso">
        <legend>Puerta local (Ollama del Mac)</legend>
        <div className="edicion-rejilla" id="ia-destino" role="group" aria-label="Dirección y puerto del Ollama">
          <Texto id="ia-host" modo="decimal" etiqueta={ETIQUETAS_IA.ollamaHost!} valor={valores.ollamaHost} onCambio={(v) => cambiar({ ollamaHost: v })} error={errorDe("ollamaHost")} />
          <Texto id="ia-puerto" modo="numeric" etiqueta={ETIQUETAS_IA.ollamaPuerto!} valor={valores.ollamaPuerto} onCambio={(v) => cambiar({ ollamaPuerto: v })} error={errorDe("ollamaPuerto")} />
          <p className="nota aviso" id="ia-destino-aviso">{AVISOS_IA.FIREWALL}</p>
        </div>
        <Texto id="ia-temperatura" modo="decimal" etiqueta={ETIQUETAS_IA.temperatura!} valor={valores.temperatura} ayuda="De 0 a 1 (0 por omisión: el mismo dato, el mismo texto)." onCambio={(v) => cambiar({ temperatura: v })} error={errorDe("temperatura")} />
        <p className={`nota${temperaturaAlta ? " aviso" : ""}`}>{AVISOS_IA.TEMPERATURA}</p>
        <PanelOllama hayDestino={datos.guardado.hayDestino} onIdentificados={alIdentificar} />
      </fieldset>

      <Tareas datos={datos} tareas={valores.tareas} instalados={instalados} errorDe={errorDe} onCambio={cambiarTarea} />

      <fieldset className="edicion-regla">
        <legend>Puerta nube (API de Claude)</legend>
        <p className="nota aviso">{AVISOS_IA.NUBE_COSTO}</p>
        <div className="edicion-rejilla">
          <Seleccion id="ia-modelo-nube" etiqueta={ETIQUETAS_IA.modeloNube!} valor={valores.modeloNube} opciones={opciones.modelosNube} ayuda={precio} onCambio={(v) => cambiar({ modeloNube: v })} error={errorDe("modeloNube")} />
          <Seleccion id="ia-esfuerzo" etiqueta={ETIQUETAS_IA.esfuerzoNube!} valor={valores.esfuerzoNube} opciones={opciones.esfuerzos} onCambio={(v) => cambiar({ esfuerzoNube: v })} error={errorDe("esfuerzoNube")} />
          <Texto id="ia-tope" modo="decimal" etiqueta={ETIQUETAS_IA.topeMensualUsd!} valor={valores.topeMensualUsd} ayuda={`De USD ${opciones.limites.topeMin} a USD ${opciones.limites.topeMax}. ${AVISOS_IA.SIN_TOPE}`} onCambio={(v) => cambiar({ topeMensualUsd: v })} error={errorDe("topeMensualUsd")} />
        </div>
        <p className="nota">{TEXTOS_IA.PRECIOS}</p>
      </fieldset>

      <div className="edicion-campo">
        <label htmlFor="ia-motivo">{ETIQUETAS_IA.motivo}</label>
        <textarea id="ia-motivo" rows={3} maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-invalid={errorDe("motivo") ? true : undefined} aria-describedby={errorDe("motivo") ? "ia-motivo-error" : undefined} />
        {errorDe("motivo") ? <p className="edicion-error" id="ia-motivo-error">{errorDe("motivo")}</p> : null}
      </div>
      <BotonEnviar texto={TEXTOS_IA.BOTON} enviando={envio.enviando} estado={TEXTOS_IA.ENVIANDO} />
    </form>
  );
}
