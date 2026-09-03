/**
 * SPEC-151 (FR-003): componente de PDF del informe mensual con
 * `@react-pdf/renderer`. Se renderiza en el servidor (Node runtime) — sin
 * headless ni browser. Solo agregados, cero PII.
 */
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { InformeMensualColegio } from "./informe-mensual";

const COLOR_PRIMARIO = "#10b981"; // emerald-500
const COLOR_TEXTO = "#1f2937"; // gray-800
const COLOR_MUTED = "#6b7280"; // gray-500
const COLOR_FONDO = "#f0fdf4"; // emerald-50
const COLOR_BORDE = "#e5e7eb"; // gray-200

const estilos = StyleSheet.create({
    pagina: {
        padding: 40,
        fontSize: 10,
        color: COLOR_TEXTO,
        fontFamily: "Helvetica",
    },
    // SPEC-379 (D1): membrete institucional del rector — mismo layout que el
    // helper `armarMembreteColegio` de pdfmake, en JSX para react-pdf.
    escudo: {
        width: 64,
        height: 64,
        marginBottom: 6,
        objectFit: "contain",
    },
    membreteNombre: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1f2937",
        marginBottom: 2,
    },
    membreteNit: {
        fontSize: 9,
        color: "#6b7280",
        marginBottom: 2,
    },
    titulo: {
        fontSize: 22,
        fontWeight: "bold",
        color: COLOR_PRIMARIO,
        marginTop: 8,
        marginBottom: 4,
    },
    subtitulo: {
        fontSize: 12,
        color: COLOR_MUTED,
        marginBottom: 16,
    },
    seccionTitulo: {
        fontSize: 14,
        fontWeight: "bold",
        color: COLOR_PRIMARIO,
        marginTop: 16,
        marginBottom: 8,
    },
    tarjetas: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 16,
    },
    tarjeta: {
        flex: 1,
        backgroundColor: COLOR_FONDO,
        borderRadius: 8,
        padding: 12,
        alignItems: "center",
    },
    tarjetaValor: {
        fontSize: 20,
        fontWeight: "bold",
        color: COLOR_PRIMARIO,
    },
    tarjetaLabel: {
        fontSize: 9,
        color: COLOR_MUTED,
        marginTop: 4,
        textAlign: "center",
    },
    tabla: {
        display: "flex",
        width: "auto",
        borderStyle: "solid",
        borderWidth: 0.5,
        borderColor: COLOR_BORDE,
        borderRadius: 4,
        overflow: "hidden",
    },
    fila: {
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: COLOR_BORDE,
        alignItems: "center",
        minHeight: 28,
    },
    filaHeader: {
        backgroundColor: COLOR_PRIMARIO,
        flexDirection: "row",
        alignItems: "center",
        minHeight: 28,
    },
    celda: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        flex: 1,
        textAlign: "left",
    },
    celdaHeader: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        flex: 1,
        color: "#ffffff",
        fontWeight: "bold",
        textAlign: "left",
    },
    celdaNumero: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        flex: 1,
        textAlign: "right",
    },
    celdaHeaderNumero: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        flex: 1,
        color: "#ffffff",
        fontWeight: "bold",
        textAlign: "right",
    },
    vacio: {
        textAlign: "center",
        color: COLOR_MUTED,
        marginVertical: 12,
    },
    nota: {
        fontSize: 9,
        color: COLOR_MUTED,
        fontStyle: "italic",
        marginTop: 16,
    },
    footer: {
        position: "absolute",
        bottom: 20,
        left: 40,
        right: 40,
        fontSize: 8,
        color: COLOR_MUTED,
        textAlign: "center",
    },
});

function formatearCategoria(categoria: string): string {
    return categoria
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

interface InformeMensualPDFProps {
    datos: InformeMensualColegio;
    etiquetaMes: string;
    generadoEl: string;
    /**
     * SPEC-379 (D1): escudo del colegio como data URI (`data:image/...;base64,...`),
     * ya cargado con `leerEscudoDataUri`. `null` cuando el colegio no lo subió —
     * el membrete sale igual, sin imagen (nunca romperse por eso).
     */
    escudoDataUri?: string | null;
}

export function InformeMensualPDF({ datos, etiquetaMes, generadoEl, escudoDataUri = null }: InformeMensualPDFProps) {
    return (
        <Document>
            <Page size="A4" style={estilos.pagina}>
                {escudoDataUri && <Image src={escudoDataUri} style={estilos.escudo} />}
                <Text style={estilos.membreteNombre}>{datos.colegioNombre}</Text>
                <Text style={estilos.membreteNit}>NIT {datos.colegioNit}</Text>
                <Text style={estilos.titulo}>Informe mensual</Text>
                <Text style={estilos.subtitulo}>
                    {etiquetaMes} · Generado el {generadoEl}
                </Text>

                <View style={estilos.tarjetas}>
                    <View style={estilos.tarjeta}>
                        <Text style={estilos.tarjetaValor}>{datos.reportesDistintos}</Text>
                        <Text style={estilos.tarjetaLabel}>Reportes distintos</Text>
                    </View>
                    <View style={estilos.tarjeta}>
                        <Text style={estilos.tarjetaValor}>{datos.alertasTotales}</Text>
                        <Text style={estilos.tarjetaLabel}>Alertas totales</Text>
                    </View>
                    <View style={estilos.tarjeta}>
                        <Text style={estilos.tarjetaValor}>{datos.cursosAfectados}</Text>
                        <Text style={estilos.tarjetaLabel}>Cursos afectados</Text>
                    </View>
                </View>

                <Text style={estilos.seccionTitulo}>Desglose por curso</Text>
                {datos.porCurso.length === 0 ? (
                    <Text style={estilos.vacio}>Sin actividad registrada en este mes.</Text>
                ) : (
                    <View style={estilos.tabla}>
                        <View style={estilos.filaHeader}>
                            <Text style={[estilos.celdaHeader, { flex: 2 }]}>Curso</Text>
                            <Text style={estilos.celdaHeaderNumero}>Reportes</Text>
                            <Text style={estilos.celdaHeaderNumero}>Alertas</Text>
                        </View>
                        {datos.porCurso.map((curso) => (
                            <View key={curso.cursoId} style={estilos.fila}>
                                <Text style={[estilos.celda, { flex: 2 }]}>{curso.nombre}</Text>
                                <Text style={estilos.celdaNumero}>{curso.reportesDistintos}</Text>
                                <Text style={estilos.celdaNumero}>{curso.alertasTotales}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <Text style={estilos.seccionTitulo}>Desglose por categoría de conducta</Text>
                {datos.porCategoria.length === 0 ? (
                    <Text style={estilos.vacio}>Sin categorías registradas en este mes.</Text>
                ) : (
                    <View style={estilos.tabla}>
                        <View style={estilos.filaHeader}>
                            <Text style={[estilos.celdaHeader, { flex: 2 }]}>Categoría</Text>
                            <Text style={estilos.celdaHeaderNumero}>Reportes</Text>
                            <Text style={estilos.celdaHeaderNumero}>Alertas</Text>
                        </View>
                        {datos.porCategoria.map((cat) => (
                            <View key={cat.categoria} style={estilos.fila}>
                                <Text style={[estilos.celda, { flex: 2 }]}>{formatearCategoria(cat.categoria)}</Text>
                                <Text style={estilos.celdaNumero}>{cat.reportesDistintos}</Text>
                                <Text style={estilos.celdaNumero}>{cat.alertasTotales}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <Text style={estilos.nota}>
                    Este informe contiene únicamente datos agregados del colegio. No incluye información personal de estudiantes, valores de identificadores ni contenido de reportes.
                </Text>

                <Text style={estilos.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
            </Page>
        </Document>
    );
}
