/** El resultado de una decisión en un horizonte: la cifra con su veredicto, enlazada a su cadena, y sus notas. */
import { textoResultado } from "./textos";
import type { ResultadoVista } from "./tipos";

export function Resultado({ resultado, href }: { readonly resultado: ResultadoVista; readonly href: string | null }) {
  const t = textoResultado(resultado);
  return (
    <>
      {href ? <a href={href}>{t.principal}</a> : <span className="resumen-resultado">{t.principal}</span>}
      {t.notas.map((nota) => <span key={nota} className="frase">{nota}</span>)}
    </>
  );
}
