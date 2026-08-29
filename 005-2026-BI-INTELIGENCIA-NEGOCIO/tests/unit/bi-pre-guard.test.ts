import { describe, it, expect } from "vitest";
import { evaluarPreGuard } from "@/lib/bi/pre-guard";

describe("evaluarPreGuard (candado 6a)", () => {
    const bloqueadosEn = [
        "DROP TABLE Reporte",
        "delete from usuarios",
        "UPDATE cursos SET x=1",
        "TRUNCATE bi_consulta_log",
        "alter table foo add col",
        "grant select on x to y",
        "revoke all",
        "insert into y values (1)",
    ];
    it.each(bloqueadosEn)("bloquea intención destructiva EN: %s", (q) => {
        expect(evaluarPreGuard(q).permitido).toBe(false);
    });

    const bloqueadosEs = ["borra el reporte", "elimina esa fila", "vacía la tabla", "resetea todo"];
    it.each(bloqueadosEs)("bloquea intención destructiva ES: %s", (q) => {
        const r = evaluarPreGuard(q);
        expect(r.permitido).toBe(false);
        expect(r.razon).toBe("intencion_destructiva");
    });

    const legitimas = [
        "cuántos reportes hoy",
        "top 5 categorías esta semana",
        "muéstrame el detalle por rol",
        "promedio de latencia últimos 7 días",
    ];
    it.each(legitimas)("deja pasar consulta legítima: %s", (q) => {
        expect(evaluarPreGuard(q).permitido).toBe(true);
    });

    it("rechaza pregunta vacía", () => {
        expect(evaluarPreGuard("").permitido).toBe(false);
        expect(evaluarPreGuard("   ").permitido).toBe(false);
    });
});
