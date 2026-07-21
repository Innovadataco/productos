"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildRegistroDespacho } from "@/lib/despachos/payload";
import type { ObjRutasIntegracion, RutaMaestra } from "@/lib/despachos/despacho-tipos";
import type { RespuestaIntegradora } from "@/lib/integracion/integradora-tipos";

function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function horaBogota(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

type Dict = Record<string, string>;

function Seccion({ titulo, abierta, children }: { titulo: string; abierta: boolean; children: React.ReactNode }) {
  return (
    <section className={`border rounded-lg bg-white ${abierta ? "" : "opacity-50 pointer-events-none"}`}>
      <h2 className="px-4 py-2 border-b font-semibold text-sicov-700">{titulo}</h2>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function Campo({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="text-sm block">
      {label}
      <input type={type} className="mt-1 w-full border rounded px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function WizardSalidaPage() {
  const router = useRouter();
  const [nit, setNit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [cabecera, setCabecera] = useState<Dict>({ valorTiquete: "", observaciones: "", fechaSalida: hoyBogota(), horaSalida: horaBogota() });

  const [placa, setPlaca] = useState("");
  const [ident1, setIdent1] = useState("");
  const [ident2, setIdent2] = useState("");
  const [integradora, setIntegradora] = useState<RespuestaIntegradora | null>(null);
  const [consultando, setConsultando] = useState(false);

  const [conductores, setConductores] = useState<Dict>({});
  const [vehiculo, setVehiculo] = useState<Dict>({ soat: "", fechaVencimientoSoat: "", revisionTecnicoMecanica: "", clase: "1", nivelServicio: "1" });

  const [rutas, setRutas] = useState<RutaMaestra[]>([]);
  const [rutaSel, setRutaSel] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (res.status === 401) return router.replace("/login");
      if (res.ok) {
        const d = (await res.json()) as { usuario: { identificacion: string; nombre: string } };
        setNit(d.usuario.identificacion ?? "");
        setRazonSocial(d.usuario.nombre ?? "");
      }
    })();
  }, [router]);

  async function consultarIntegradora() {
    setConsultando(true);
    setError(null);
    try {
      const res = await fetch("/api/integracion/integradora/resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa, numeroIdentificacion1: ident1, numeroIdentificacion2: ident2 || undefined, fechaConsulta: cabecera.fechaSalida }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "No fue posible consultar la integradora");
        return;
      }
      const data = (await res.json()) as RespuestaIntegradora;
      setIntegradora(data);
      // Autocompletar conductores desde la integradora.
      setConductores({
        numeroIdentificacion: data.conductor1.persona.numeroIdentificacion,
        primerNombrePrincipal: data.conductor1.persona.primerNombre,
        primerApellidoPrincipal: data.conductor1.persona.primerApellido,
        licenciaConduccion: data.conductor1.licencia.numeroLicencia,
        fechaVencimientoLicencia: data.conductor1.licencia.fechaVencimiento,
        idExamenMedico: data.conductor1.examenMedico.codigo,
        idPruebaAlcoholimetria: data.conductor1.alcoholimetria.codigo,
        ...(data.conductor2
          ? {
              numeroIdentificacionSecundario: data.conductor2.persona.numeroIdentificacion,
              licenciaConduccionSecundario: data.conductor2.licencia.numeroLicencia,
            }
          : {}),
      });
      setVehiculo((v) => ({ ...v, placa, soat: data.vehiculo.numeroSoat, fechaVencimientoSoat: data.vehiculo.soatVencimiento, revisionTecnicoMecanica: data.vehiculo.numeroRtm, fechaRevisionTecnicoMecanica: data.vehiculo.rtmVencimiento }));
      // Cargar rutas.
      const rr = await fetch(`/api/integracion/maestras/rutas-activas-empresa?nit=${encodeURIComponent(nit)}`);
      if (rr.ok) setRutas(((await rr.json()) as { items: RutaMaestra[] }).items);
    } catch {
      setError("Error de red");
    } finally {
      setConsultando(false);
    }
  }

  const puedeRegistrar = !!integradora && !!rutaSel && !!vehiculo.placa && !!conductores.numeroIdentificacion;

  async function registrar() {
    setEnviando(true);
    setError(null);
    setOk(null);
    try {
      const ruta = rutas.find((r) => r.idRutaAutorizada === rutaSel);
      if (!ruta) {
        setError("Selecciona una ruta");
        return;
      }
      const objRuta: ObjRutasIntegracion = {
        idRutaAutorizada: ruta.idRutaAutorizada,
        idOrigen: ruta.idOrigen,
        detalleOrigen: ruta.detalleOrigen,
        idDestino: ruta.idDestino,
        detalleDestino: ruta.detalleDestino,
        via: ruta.via,
        centroPobladoOrigen: ruta.centroPobladoOrigen,
        centroPobladoDestino: ruta.centroPobladoDestino,
      };
      const payload = buildRegistroDespacho({
        cabecera: { ...cabecera, nitEmpresaTransporte: nit, razonSocial },
        vehiculoForm: vehiculo,
        conductoresForm: conductores,
        ruta: objRuta,
        integradora,
        incluirSecundario: !!integradora?.conductor2,
      });
      const res = await fetch("/api/integracion/despachos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "No fue posible registrar el despacho");
        return;
      }
      const d = (await res.json()) as { solicitudId: number };
      setOk(`Despacho registrado (solicitud #${d.solicitudId}). Se reportará por la cola.`);
    } catch {
      setError("Error de red");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-sicov-700">Registrar salida (despacho)</h1>

      <Seccion titulo="1. Cabecera" abierta>
        <p className="text-sm text-gray-600">Empresa: {razonSocial} — NIT {nit}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo label="Valor tiquete" value={cabecera.valorTiquete} onChange={(v) => setCabecera({ ...cabecera, valorTiquete: v })} />
          <Campo label="Observaciones" value={cabecera.observaciones} onChange={(v) => setCabecera({ ...cabecera, observaciones: v })} />
          <Campo label="Fecha salida" type="date" value={cabecera.fechaSalida} onChange={(v) => setCabecera({ ...cabecera, fechaSalida: v })} />
          <Campo label="Hora salida" type="time" value={cabecera.horaSalida} onChange={(v) => setCabecera({ ...cabecera, horaSalida: v })} />
        </div>
      </Seccion>

      <Seccion titulo="2. Consulta integradora (habilita el resto)" abierta>
        <div className="grid gap-3 md:grid-cols-3">
          <Campo label="Placa" value={placa} onChange={setPlaca} />
          <Campo label="Identificación conductor" value={ident1} onChange={setIdent1} />
          <Campo label="Identificación 2 (opcional)" value={ident2} onChange={setIdent2} />
        </div>
        <button onClick={consultarIntegradora} disabled={consultando || !placa || !ident1} className="bg-sicov-700 text-white rounded px-4 py-2 disabled:opacity-50">
          {consultando ? "Consultando…" : "Consultar integradora"}
        </button>
        {integradora && <p className="text-sm text-sicov-700">✓ Integradora consultada — secciones habilitadas.</p>}
      </Seccion>

      <Seccion titulo="3. Conductores" abierta={!!integradora}>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo label="N° identificación" value={conductores.numeroIdentificacion ?? ""} onChange={(v) => setConductores({ ...conductores, numeroIdentificacion: v })} />
          <Campo label="Licencia" value={conductores.licenciaConduccion ?? ""} onChange={(v) => setConductores({ ...conductores, licenciaConduccion: v })} />
        </div>
        {integradora?.conductor2 && <p className="text-sm text-gray-600">Segundo conductor: {conductores.numeroIdentificacionSecundario}</p>}
      </Seccion>

      <Seccion titulo="4. Vehículo" abierta={!!integradora}>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo label="Placa" value={vehiculo.placa ?? ""} onChange={(v) => setVehiculo({ ...vehiculo, placa: v })} />
          <Campo label="SOAT" value={vehiculo.soat ?? ""} onChange={(v) => setVehiculo({ ...vehiculo, soat: v })} />
          <Campo label="RTM" value={vehiculo.revisionTecnicoMecanica ?? ""} onChange={(v) => setVehiculo({ ...vehiculo, revisionTecnicoMecanica: v })} />
          <Campo label="Clase" value={vehiculo.clase ?? ""} onChange={(v) => setVehiculo({ ...vehiculo, clase: v })} />
          <Campo label="Nivel de servicio" value={vehiculo.nivelServicio ?? ""} onChange={(v) => setVehiculo({ ...vehiculo, nivelServicio: v })} />
        </div>
      </Seccion>

      <Seccion titulo="5. Rutas" abierta={!!integradora}>
        <label className="text-sm block">Ruta autorizada
          <select className="mt-1 w-full border rounded px-3 py-2" value={rutaSel} onChange={(e) => setRutaSel(e.target.value)}>
            <option value="">— Selecciona —</option>
            {rutas.map((r) => (
              <option key={r.idRutaAutorizada} value={r.idRutaAutorizada}>{r.nombre ?? `${r.detalleOrigen} - ${r.detalleDestino}`}</option>
            ))}
          </select>
        </label>
      </Seccion>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {ok && <p className="text-sicov-700 text-sm">{ok}</p>}

      <div className="flex gap-3">
        <button onClick={registrar} disabled={!puedeRegistrar || enviando} className="bg-sicov-700 text-white rounded px-6 py-2 disabled:opacity-50">
          {enviando ? "Registrando…" : "Registrar despacho"}
        </button>
        <a href="/dashboard/salidas" className="px-4 py-2 border rounded text-sm">Volver al listado</a>
      </div>
    </main>
  );
}
