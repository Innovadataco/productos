/** Las tarifas vigentes hoy (con su control contra las órdenes pasadas) y la historia de versiones. Del servidor. */
import { AYUDAS_TARIFA, TEXTOS_TARIFAS } from "./textos-tarifas";
import type { DatosEdicionTarifas } from "./tipos-tarifas";

export function Vigentes({ datos }: { readonly datos: DatosEdicionTarifas }) {
  return (
    <section className="tarifa-bloque" aria-labelledby="t-vigentes">
      <h2 id="t-vigentes">{TEXTOS_TARIFAS.VIGENTES}</h2>
      <p>{TEXTOS_TARIFAS.INTRO}</p>
      <p className="nota">{TEXTOS_TARIFAS.FORMULA}</p>
      <ul className="tarifa-vigentes">
        {datos.vigentes.map((v) => (
          <li key={`${v.comisionista}-${v.lado}`} className="tarifa-vigente">
            <h3>{v.comisionista} · {v.lado}</h3>
            {v.tarifa === null ? (
              <p className="nota">{TEXTOS_TARIFAS.SIN_TARIFA}</p>
            ) : (
              <>
                <p>{v.tarifa.detalle}</p>
                <p className="nota">Versión {v.tarifa.version} · desde el {v.tarifa.desde}</p>
                <p className="tarifa-control">{v.control}</p>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="nota">{TEXTOS_TARIFAS.TOLERANCIA}</p>
      <p className="nota">{AYUDAS_TARIFA.vigenteDesde}</p>
    </section>
  );
}

export function Historia({ datos }: { readonly datos: DatosEdicionTarifas }) {
  return (
    <section className="tarifa-bloque" aria-labelledby="t-historia">
      <h2 id="t-historia">{TEXTOS_TARIFAS.HISTORIA}</h2>
      {datos.historia.length === 0 ? (
        <p className="nota">{TEXTOS_TARIFAS.SIN_HISTORIA}</p>
      ) : (
        <ol className="tarifa-historia">
          {datos.historia.map((t) => (
            <li key={t.version}>
              <span className={t.version === datos.guardada ? "tarifa-guardada" : undefined}>
                Versión {t.version} · {t.comisionista} · {t.lado} · desde el {t.desde}{t.version === datos.guardada ? ` · ${TEXTOS_TARIFAS.GUARDADA}` : ""}
              </span>
              <p>{t.detalle}</p>
              <p>Guardada el {t.creada} · Motivo: «{t.motivo}»</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
