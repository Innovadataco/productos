/**
 * SPEC-154 — PDF del protocolo de confianza.
 * Renderiza el contenido Markdown del protocolo de forma legible, sin PII.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const estilos = StyleSheet.create({
    pagina: {
        padding: 40,
        fontSize: 10,
        color: "#1f2937",
        fontFamily: "Helvetica",
    },
    titulo: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#10b981",
        marginBottom: 8,
    },
    subtitulo: {
        fontSize: 10,
        color: "#6b7280",
        marginBottom: 16,
    },
    parrafo: {
        marginBottom: 8,
        lineHeight: 1.4,
    },
    heading: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#10b981",
        marginTop: 12,
        marginBottom: 6,
    },
    subheading: {
        fontSize: 12,
        fontWeight: "bold",
        marginTop: 10,
        marginBottom: 4,
    },
    listItem: {
        marginLeft: 12,
        marginBottom: 4,
    },
    footer: {
        position: "absolute",
        bottom: 20,
        left: 40,
        right: 40,
        fontSize: 8,
        color: "#6b7280",
        textAlign: "center",
    },
});

interface ProtocoloPDFProps {
    colegioNombre: string;
    titulo: string;
    markdown: string;
    generadoEl: string;
}

function parseLine(line: string) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return { type: "h1", text: trimmed.slice(2) } as const;
    if (trimmed.startsWith("## ")) return { type: "h2", text: trimmed.slice(3) } as const;
    if (trimmed.startsWith("### ")) return { type: "h3", text: trimmed.slice(4) } as const;
    if (/^(-|\*|\d+\.)\s+/.test(trimmed)) {
        return { type: "li", text: trimmed.replace(/^(-|\*|\d+\.)\s+/, "") } as const;
    }
    if (trimmed === "") return { type: "empty", text: "" } as const;
    return { type: "p", text: trimmed } as const;
}

export function ProtocoloPDF({ colegioNombre, titulo, markdown, generadoEl }: ProtocoloPDFProps) {
    const bloques = markdown.split("\n").map(parseLine);

    return (
        <Document>
            <Page size="A4" style={estilos.pagina}>
                <Text style={estilos.titulo}>{titulo}</Text>
                <Text style={estilos.subtitulo}>
                    {colegioNombre} · Generado el {generadoEl}
                </Text>

                {bloques.map((bloque, idx) => {
                    if (bloque.type === "empty") return null;
                    if (bloque.type === "h1") return <Text key={idx} style={estilos.heading}>{bloque.text}</Text>;
                    if (bloque.type === "h2") return <Text key={idx} style={estilos.heading}>{bloque.text}</Text>;
                    if (bloque.type === "h3") return <Text key={idx} style={estilos.subheading}>{bloque.text}</Text>;
                    if (bloque.type === "li") return <Text key={idx} style={estilos.listItem}>• {bloque.text}</Text>;
                    return <Text key={idx} style={estilos.parrafo}>{bloque.text}</Text>;
                })}

                <Text style={estilos.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
            </Page>
        </Document>
    );
}
