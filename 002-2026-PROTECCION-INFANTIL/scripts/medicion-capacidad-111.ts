/**
 * Medición de capacidad D-28 (002-PI-029): tiempo de UN reporte de punta a punta
 * por el pipeline REAL (POST /api/reportes/procesar, la misma ruta del worker),
 * con el motor LEGACY (ia.rubrica.enabled=false) y con la RÚBRICA (enabled=true).
 * No estima: ejecuta y cronometra. Uso: node --env-file=.env --import tsx scripts/medicion-capacidad-111.ts
 */
import { prisma } from "../src/lib/prisma";
import { POST } from "../src/app/api/reportes/procesar/route";

const TEXTO_BANCO =
    "Un hombre adulto le escribe a mi hija de 14 años todos los días ofreciéndole dinero por fotos íntimas. Le dice que no le cuente a nadie porque es un secreto entre ellos dos. Insiste aunque ella no responde.";

async function medirUnReporte(etiqueta: string): Promise<number> {
    const plataforma = await prisma.plataforma.findFirst();
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `medicion-capacidad-${Date.now()}`,
            plataformaId: plataforma!.id,
            texto: TEXTO_BANCO,
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-MED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            estado: "PENDIENTE",
        },
    });

    const inicio = Date.now();
    const req = new Request("http://localhost:5005/api/reportes/procesar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Worker-Secret": process.env.WORKER_SECRET ?? "" },
        body: JSON.stringify({ reporteId: reporte.id }),
    });
    const res = await POST(req);
    const latenciaMs = Date.now() - inicio;
    const body = await res.json().catch(() => ({}));
    const final = await prisma.reporte.findUnique({ where: { id: reporte.id }, select: { estado: true } });
    console.log(`[MEDICION] ${etiqueta}: ${(latenciaMs / 1000).toFixed(1)} s · http=${res.status} · estado=${final?.estado} · ${JSON.stringify(body).slice(0, 120)}`);
    return latenciaMs;
}

async function fijarEnabled(valor: boolean) {
    await prisma.parametroSistema.update({ where: { clave: "ia.rubrica.enabled" }, data: { valor: String(valor) } });
    console.log(`[MEDICION] ia.rubrica.enabled = ${valor}`);
}

async function main() {
    await fijarEnabled(false);
    const a = await medirUnReporte("a) LEGACY punta a punta");

    await fijarEnabled(true);
    const b = await medirUnReporte("b) RÚBRICA punta a punta");

    await fijarEnabled(false); // deja el motor default intacto (D-19 mientras no se despliegue D-28)

    const porHora1 = 3600 / (b / 1000);
    const concurrencia = parseInt((await prisma.parametroSistema.findUnique({ where: { clave: "worker.concurrencia" } }))?.valor ?? "2", 10);
    console.log(`[MEDICION] c) reportes/hora con rúbrica (1 worker): ${porHora1.toFixed(1)} · con concurrencia=${concurrencia}: ${(porHora1 * concurrencia).toFixed(1)}`);
    console.log(`[MEDICION] b > 180 s ? ${b > 180000 ? "SÍ — PARAR Y REPORTAR" : "NO — dentro del tope"}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
