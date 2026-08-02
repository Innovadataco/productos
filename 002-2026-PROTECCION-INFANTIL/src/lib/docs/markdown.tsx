/**
 * SPEC-017 — Renderizador mínimo de Markdown a JSX (server-safe).
 * Construye elementos React (React escapa los strings: sin HTML crudo ni
 * dangerouslySetInnerHTML). Cubre lo que usan los documentos del repo:
 * encabezados, párrafos, listas, tablas, código en bloque e inline, negrita,
 * cursiva, enlaces (http/https y relativos internos) y citas.
 */
import React from "react";

function renderInline(texto: string, keyPrefix: string): React.ReactNode[] {
    // Orden importa: código inline primero (protege su contenido), luego negrita,
    // cursiva y enlaces. Todo se devuelve como nodos React (escapado automático).
    const partes: React.ReactNode[] = [];
    const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
    let ultimo = 0;
    let match: RegExpExecArray | null;
    let i = 0;

    while ((match = regex.exec(texto)) !== null) {
        if (match.index > ultimo) {
            partes.push(texto.slice(ultimo, match.index));
        }
        const token = match[0];
        const key = `${keyPrefix}-${i++}`;
        if (token.startsWith("`")) {
            partes.push(
                <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-slate-800">
                    {token.slice(1, -1)}
                </code>
            );
        } else if (token.startsWith("**")) {
            partes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith("*")) {
            partes.push(<em key={key}>{token.slice(1, -1)}</em>);
        } else {
            const enlace = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
            if (enlace) {
                const [, textoEnlace, href] = enlace;
                const esSeguro = /^https?:\/\//.test(href) || href.startsWith("/") || href.startsWith("#");
                if (esSeguro) {
                    partes.push(
                        <a key={key} href={href} className="text-sky-600 underline dark:text-cyan-400" {...(/^https?:\/\//.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                            {textoEnlace}
                        </a>
                    );
                } else {
                    partes.push(textoEnlace);
                }
            } else {
                partes.push(token);
            }
        }
        ultimo = match.index + token.length;
    }
    if (ultimo < texto.length) {
        partes.push(texto.slice(ultimo));
    }
    return partes;
}

function esFilaTabla(linea: string): boolean {
    return linea.trim().startsWith("|") && linea.trim().endsWith("|");
}

function esSeparadorTabla(linea: string): boolean {
    return /^\|[\s:|-]+\|$/.test(linea.trim());
}

function celdasTabla(linea: string): string[] {
    return linea.trim().slice(1, -1).split("|").map((c) => c.trim());
}

export function Markdown({ source }: { source: string }) {
    const lineas = source.split("\n");
    const bloques: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lineas.length) {
        const linea = lineas[i];

        // Código en bloque
        if (linea.trimStart().startsWith("```")) {
            const contenido: string[] = [];
            i++;
            while (i < lineas.length && !lineas[i].trimStart().startsWith("```")) {
                contenido.push(lineas[i]);
                i++;
            }
            i++; // cierra fence
            bloques.push(
                <pre key={key++} className="overflow-x-auto rounded-xl bg-slate-100 p-4 text-xs dark:bg-slate-900">
                    <code>{contenido.join("\n")}</code>
                </pre>
            );
            continue;
        }

        // Tabla
        if (esFilaTabla(linea) && i + 1 < lineas.length && esSeparadorTabla(lineas[i + 1])) {
            const encabezados = celdasTabla(linea);
            i += 2;
            const filas: string[][] = [];
            while (i < lineas.length && esFilaTabla(lineas[i])) {
                filas.push(celdasTabla(lineas[i]));
                i++;
            }
            bloques.push(
                <div key={key++} className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                {encabezados.map((h, idx) => (
                                    <th key={idx} className="border-b border-slate-300 px-2 py-1 text-left font-semibold dark:border-slate-700">
                                        {renderInline(h, `th-${idx}`)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((fila, fi) => (
                                <tr key={fi}>
                                    {fila.map((celda, ci) => (
                                        <td key={ci} className="border-b border-slate-200 px-2 py-1 align-top dark:border-slate-800">
                                            {renderInline(celda, `td-${fi}-${ci}`)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        const trim = linea.trim();

        // Encabezados
        const heading = /^(#{1,4})\s+(.*)$/.exec(trim);
        if (heading) {
            const nivel = heading[1].length;
            const contenido = renderInline(heading[2], `h-${key}`);
            const clases =
                nivel === 1
                    ? "mt-8 text-2xl font-bold text-body"
                    : nivel === 2
                        ? "mt-6 text-xl font-semibold text-body"
                        : nivel === 3
                            ? "mt-4 text-lg font-semibold text-body"
                            : "mt-3 text-base font-semibold text-body";
            bloques.push(
                nivel === 1 ? (
                    <h1 key={key++} className={clases}>{contenido}</h1>
                ) : nivel === 2 ? (
                    <h2 key={key++} className={clases}>{contenido}</h2>
                ) : nivel === 3 ? (
                    <h3 key={key++} className={clases}>{contenido}</h3>
                ) : (
                    <h4 key={key++} className={clases}>{contenido}</h4>
                )
            );
            i++;
            continue;
        }

        // Regla horizontal
        if (/^(-{3,}|\*{3,})$/.test(trim)) {
            bloques.push(<hr key={key++} className="my-6 border-slate-200 dark:border-slate-800" />);
            i++;
            continue;
        }

        // Cita
        if (trim.startsWith(">")) {
            const citas: string[] = [];
            while (i < lineas.length && lineas[i].trim().startsWith(">")) {
                citas.push(lineas[i].trim().replace(/^>\s?/, ""));
                i++;
            }
            bloques.push(
                <blockquote key={key++} className="border-l-4 border-slate-300 pl-4 text-sm text-muted dark:border-slate-700">
                    {citas.map((c, ci) => (
                        <p key={ci} className="my-1">{renderInline(c, `q-${ci}`)}</p>
                    ))}
                </blockquote>
            );
            continue;
        }

        // Lista (con o sin orden)
        if (/^(-|\*|\d+\.)\s+/.test(trim)) {
            const ordenada = /^\d+\.\s+/.test(trim);
            const items: string[] = [];
            while (i < lineas.length && /^(-|\*|\d+\.)\s+/.test(lineas[i].trim())) {
                items.push(lineas[i].trim().replace(/^(-|\*|\d+\.)\s+/, ""));
                i++;
            }
            const LisTag = ordenada ? "ol" : "ul";
            bloques.push(
                <LisTag key={key++} className={`my-2 space-y-1 pl-6 text-sm ${ordenada ? "list-decimal" : "list-disc"}`}>
                    {items.map((item, ii) => (
                        <li key={ii}>{renderInline(item, `li-${ii}`)}</li>
                    ))}
                </LisTag>
            );
            continue;
        }

        // Línea vacía
        if (trim === "") {
            i++;
            continue;
        }

        // Párrafo (acumula líneas consecutivas)
        const parrafo: string[] = [trim];
        i++;
        while (i < lineas.length && lineas[i].trim() !== "" && !/^(#{1,4}\s|>|```|-{3,}|\*{3,}|(-|\*|\d+\.)\s|\|)/.test(lineas[i].trim())) {
            parrafo.push(lineas[i].trim());
            i++;
        }
        bloques.push(
            <p key={key++} className="my-2 text-sm leading-relaxed text-body">
                {renderInline(parrafo.join(" "), `p-${key}`)}
            </p>
        );
    }

    return <div className="docs-markdown">{bloques}</div>;
}
