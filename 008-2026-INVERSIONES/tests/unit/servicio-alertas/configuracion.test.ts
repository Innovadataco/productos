// La credencial del servicio inv-008-alertas: solo la del rol inv_alertas en inv-008-db, por la red interna. Sin ella, EN ESPERA
// (no se cae); con otra, también. Ningún motivo repite la URL ni su clave. Datos inventados.
import { describe, expect, it } from "vitest";
import { HOST_BASE, USUARIO_ALERTAS, revisarCredencialAlertas } from "@/servicio-alertas/configuracion";

const CLAVE = "clave-ficticia-5120";
const url = (parte: string): string => `postgresql://${parte}`;
const buena = url(`inv_alertas:${CLAVE}@inv-008-db:5432/inversiones?connection_limit=2`);

describe("revisarCredencialAlertas", () => {
  it("la de inv_alertas en inv-008-db, con connection_limit 1 o 2: sirve", () => {
    expect(USUARIO_ALERTAS).toBe("inv_alertas");
    expect(HOST_BASE).toBe("inv-008-db");
    expect(revisarCredencialAlertas(buena)).toEqual({ ok: true });
    expect(revisarCredencialAlertas(buena.replace("=2", "=1"))).toEqual({ ok: true });
    expect(revisarCredencialAlertas(url(`inv_alertas:${CLAVE}@inv-008-db/inversiones?schema=public&connection_limit=1&connect_timeout=5`))).toEqual({ ok: true });
  });

  it.each([undefined, "", "   "])("sin la variable (%j): SIN_SECRETO, queda en espera", (valor) => {
    const r = revisarCredencialAlertas(valor);
    expect(r).toMatchObject({ ok: false, estado: "SIN_SECRETO" });
    expect(r.ok ? "" : r.motivo).toContain("INV_ALERTAS_DATABASE_URL");
  });

  it.each([
    ["no es una URL", "esto no es una url"],
    ["otro protocolo", `mysql://inv_alertas:${CLAVE}@inv-008-db/inversiones?connection_limit=2`],
    ["otro usuario", url(`inv_app:${CLAVE}@inv-008-db/inversiones?connection_limit=2`)],
    ["el dueño", url(`inv_dueno:${CLAVE}@inv-008-db/inversiones?connection_limit=2`)],
    ["otra base (host)", url(`inv_alertas:${CLAVE}@otro-host/inversiones?connection_limit=2`)],
    ["sin clave", url("inv_alertas@inv-008-db/inversiones?connection_limit=2")],
    ["otro puerto", url(`inv_alertas:${CLAVE}@inv-008-db:6543/inversiones?connection_limit=2`)],
    ["sin nombre de base", url(`inv_alertas:${CLAVE}@inv-008-db/?connection_limit=2`)],
    ["sin connection_limit", url(`inv_alertas:${CLAVE}@inv-008-db/inversiones`)],
    ["connection_limit 3", url(`inv_alertas:${CLAVE}@inv-008-db/inversiones?connection_limit=3`)],
    ["un parámetro fuera de la lista (host)", url(`inv_alertas:${CLAVE}@inv-008-db/inversiones?connection_limit=2&host=otro`)],
    ["un parámetro repetido", url(`inv_alertas:${CLAVE}@inv-008-db/inversiones?connection_limit=2&connection_limit=2`)],
  ])("%s: SECRETO_INVALIDO, sin repetir la URL ni la clave", (_n, valor) => {
    const r = revisarCredencialAlertas(valor);
    expect(r).toMatchObject({ ok: false, estado: "SECRETO_INVALIDO" });
    const motivo = r.ok ? "" : r.motivo;
    expect(motivo).not.toContain(CLAVE);
    expect(motivo).not.toContain("postgresql://");
    expect(motivo).not.toContain("inv-008-db:");
    expect(motivo).toContain("INV_ALERTAS_DATABASE_URL");
  });
});
