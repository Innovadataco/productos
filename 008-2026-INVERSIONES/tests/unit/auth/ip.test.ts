// IP del cliente para los topes (D-014): sale de `Cf-Connecting-IP` (la pone el túnel de Cloudflare),
// validada. IPv4 se cuenta por /32 e IPv6 por /64 (un cliente IPv6 suele tener la /64 entera).
// Todas las IP son de rangos de documentación (RFC 5737 y RFC 3849).
import { describe, expect, it } from "vitest";
import { ipDeSolicitud, redDeIp } from "@/auth/ip";

const con = (valor: string) => new Headers({ "cf-connecting-ip": valor });

describe("ipDeSolicitud", () => {
  it("toma Cf-Connecting-IP si es una IP válida", () => {
    expect(ipDeSolicitud(con("203.0.113.9"))).toBe("203.0.113.9");
    expect(ipDeSolicitud(con(" 2001:db8::1 "))).toBe("2001:db8::1");
  });

  it("sin cabecera, o con basura, devuelve null (cuenta en el balde «sin IP»)", () => {
    expect(ipDeSolicitud(new Headers())).toBeNull();
    expect(ipDeSolicitud(con("no-es-ip"))).toBeNull();
    expect(ipDeSolicitud(con("203.0.113.9, 198.51.100.1"))).toBeNull();
    expect(ipDeSolicitud(con("fe80::1%eth0"))).toBeNull();
  });

  it("una IPv4 escrita como IPv6 se guarda como IPv4 (::ffff:a.b.c.d y su forma hexadecimal)", () => {
    expect(ipDeSolicitud(con("::ffff:203.0.113.9"))).toBe("203.0.113.9");
    expect(ipDeSolicitud(con("::FFFF:cb00:7109"))).toBe("203.0.113.9");
    expect(ipDeSolicitud(con("0:0:0:0:0:ffff:cb00:7109"))).toBe("203.0.113.9");
  });

  it("no mira X-Forwarded-For", () => {
    expect(ipDeSolicitud(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBeNull();
  });
});

describe("redDeIp", () => {
  it("IPv4 cuenta por /32", () => {
    expect(redDeIp("203.0.113.9")).toBe("203.0.113.9/32");
  });

  it("IPv6 cuenta por /64: dos hosts de la misma /64 caen en la misma red", () => {
    expect(redDeIp("2001:db8:a:b::1")).toBe("2001:db8:a:b::/64");
    expect(redDeIp("2001:db8:a:b:ffff::2")).toBe("2001:db8:a:b::/64");
    expect(redDeIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(redDeIp("2001:0db8:000a:000b::1")).toBe("2001:db8:a:b::/64");
  });

  it("una IPv4 escrita como IPv6 cuenta como esa IPv4 (/32), en cualquiera de sus formas", () => {
    expect(redDeIp("::ffff:203.0.113.9")).toBe("203.0.113.9/32");
    expect(redDeIp("::ffff:cb00:7109")).toBe("203.0.113.9/32");
  });

  it("sin IP no hay red", () => {
    expect(redDeIp(null)).toBeNull();
  });
});
