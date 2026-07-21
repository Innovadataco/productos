"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RespuestaIntegradora, Conductor } from "@/lib/integracion/integradora-tipos";

function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function Estado({ valor }: { valor: string }) {
  const vigente = /vigente|apto|negativo/i.test(valor);
  return (
    <span className={vigente ? "text-sicov-700 font-medium" : "text-red-600 font-medium"}>{valor}</span>
  );
}

function ConductorCard({ c, titulo }: { c: Conductor; titulo: string }) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-semibold text-sicov-700 mb-2">{titulo}</h3>
      <p className="text-sm">
        {c.persona.numeroIdentificacion} — {c.persona.nombres} {c.persona.apellidos}
      </p>
      <ul className="text-sm mt-2 space-y-1">
        <li>Licencia {c.licencia.numeroLicencia}: <Estado valor={c.licencia.estado} /> (vence {c.licencia.fechaVencimiento})</li>
        <li>Alcoholimetría: <Estado valor={c.alcoholimetria.resultado} /> ({c.alcoholimetria.fecha})</li>
        <li>Examen médico: <Estado valor={c.examenMedico.resultado} /> ({c.examenMedico.fecha})</li>
        <li>Aptitud física: <Estado valor={c.aptitudFisica.resultado} /></li>
      </ul>
    </div>
  );
}

export default function IntegradoraPage() {
  const router = useRouter();
  const [placa, setPlaca] = useState("");
  const [ident1, setIdent1] = useState("");
  const [ident2, setIdent2] = useState("");
  const [fecha, setFecha] = useState(hoyBogota());
  const [hora, setHora] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<RespuestaIntegradora | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setResumen(null);
    try {
      const res = await fetch("/api/integracion/integradora/resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placa,
          numeroIdentificacion1: ident1,
          numeroIdentificacion2: ident2 || undefined,
          fechaConsulta: fecha,
          horaConsulta: hora || undefined,
        }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "No fue posible consultar");
        return;
      }
      setResumen((await res.json()) as RespuestaIntegradora);
    } catch {
      setError("Error de red");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-semibold text-sicov-700 mb-1">Consulta integradora</h1>
      <p className="text-sm text-gray-500 mb-6">
        Verificación informativa <strong>en vivo</strong> (no es un veredicto persistente).
      </p>

      <form onSubmit={consultar} className="flex flex-wrap gap-3 items-end mb-6">
        <label className="text-sm">Placa
          <input className="mt-1 block border rounded px-3 py-2" value={placa} onChange={(e) => setPlaca(e.target.value)} required />
        </label>
        <label className="text-sm">Identificación conductor
          <input className="mt-1 block border rounded px-3 py-2" value={ident1} onChange={(e) => setIdent1(e.target.value)} required />
        </label>
        <label className="text-sm">Identificación 2 (opcional)
          <input className="mt-1 block border rounded px-3 py-2" value={ident2} onChange={(e) => setIdent2(e.target.value)} />
        </label>
        <label className="text-sm">Fecha
          <input type="date" className="mt-1 block border rounded px-3 py-2" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
        <label className="text-sm">Hora {fecha !== hoyBogota() && <span className="text-red-600">*</span>}
          <input type="time" className="mt-1 block border rounded px-3 py-2" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
        <button type="submit" disabled={cargando || !placa || !ident1} className="bg-sicov-700 text-white rounded px-4 py-2 disabled:opacity-50">
          {cargando ? "Consultando…" : "Consultar"}
        </button>
      </form>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {resumen && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ConductorCard c={resumen.conductor1} titulo="Conductor principal" />
            {resumen.conductor2 && <ConductorCard c={resumen.conductor2} titulo="Conductor secundario" />}
          </div>
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold text-sicov-700 mb-2">Vehículo {resumen.vehiculo.placa}</h3>
            <ul className="text-sm space-y-1">
              <li>Clase: {resumen.vehiculo.claseVehiculo}</li>
              <li>SOAT {resumen.vehiculo.numeroSoat} — vence {resumen.vehiculo.soatVencimiento}</li>
              <li>RTM {resumen.vehiculo.numeroRtm} — vence {resumen.vehiculo.rtmVencimiento}</li>
              <li>Póliza contractual: <Estado valor={resumen.polizas.contractual.estado} /> (vence {resumen.polizas.contractual.vencimiento})</li>
              <li>Tarjeta de operación {resumen.tarjetaOperacion.numero}: <Estado valor={resumen.tarjetaOperacion.estado} /> (vence {resumen.tarjetaOperacion.vencimiento})</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
