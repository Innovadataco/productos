import { Injectable, inject } from '@angular/core';
import { map, of } from 'rxjs';
import { DespachosService } from '../../despachos/services/despachos.service';
import { ConsultaIntegradoraBody, RegistroLlegadaIntegracion } from '../../despachos/models/Integracion';
import { Llegadas } from '../../despachos/models/Llegadas';

const IDS_KEY = 'llegadas_solicitud_ids_v1';

export interface LlegadasListadoMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface LlegadasListadoResult {
  data: Llegadas[];
  meta: LlegadasListadoMeta;
}

const META_VACIA = (pageSize: number): LlegadasListadoMeta => ({
  total: 0,
  per_page: pageSize,
  current_page: 1,
  last_page: 1,
});

@Injectable({ providedIn: 'root' })
export class LlegadasRegistroService {
  private readonly despachos = inject(DespachosService);

  /** GET /api/v1/integracion/llegadas — paginación desde API. */
  listar(nit?: string, page = 1, numeroItems = 10) {
    if (!nit) return of({ data: [] as Llegadas[], meta: META_VACIA(numeroItems) });

    return this.despachos.listarLlegadas(nit, page, numeroItems).pipe(
      map((resp) => this.parseListado(resp, numeroItems))
    );
  }

  consultarSolicitud(id: number) {
    return this.despachos.obtenerSolicitudLlegada(id).pipe(
      map((resp) => this.normalizarLlegada(this.asRecord(resp)))
    );
  }

  registrarSolicitudId(id: number): void {
    if (!Number.isFinite(id) || id <= 0) return;
    const ids = this.leerSolicitudIds().filter((current) => current !== id);
    ids.unshift(id);
    sessionStorage.setItem(IDS_KEY, JSON.stringify(ids.slice(0, 100)));
  }

  consultarSalidaPorPlaca(placa: string, fechaSalida?: string) {
    return this.despachos.consultarSalidaPorPlaca(placa, fechaSalida);
  }

  registrarLlegadaIntegracion(payload: RegistroLlegadaIntegracion) {
    return this.despachos.registrarLlegadaIntegracion(payload);
  }

  consultarIntegradora(body: ConsultaIntegradoraBody) {
    return this.despachos.consultaIntegradora(body);
  }

  private parseListado(resp: unknown, fallbackPageSize: number): LlegadasListadoResult {
    const root = this.asRecord(resp);
    const arrayData = root['array_data'];
    let meta = META_VACIA(fallbackPageSize);
    let data: Llegadas[] = [];

    if (arrayData && typeof arrayData === 'object' && !Array.isArray(arrayData)) {
      const container = arrayData as Record<string, unknown>;
      const metaRaw = this.asRecord(container['meta']);
      if (Object.keys(metaRaw).length) {
        meta = {
          total: Number(metaRaw['total'] ?? 0),
          per_page: Number(metaRaw['per_page'] ?? fallbackPageSize) || fallbackPageSize,
          current_page: Number(metaRaw['current_page'] ?? 1) || 1,
          last_page: Number(metaRaw['last_page'] ?? 1) || 1,
        };
      }
      const list = container['data'];
      if (Array.isArray(list)) {
        data = list.map((item) => this.normalizarLlegada(this.asRecord(item)));
      }
      return { data, meta };
    }

    if (Array.isArray(arrayData)) {
      data = arrayData.map((item) => this.normalizarLlegada(this.asRecord(item)));
      return { data, meta: { total: data.length, per_page: fallbackPageSize, current_page: 1, last_page: 1 } };
    }

    const flat = root['data'];
    if (Array.isArray(flat)) {
      data = flat.map((item) => this.normalizarLlegada(this.asRecord(item)));
      return { data, meta: { total: data.length, per_page: fallbackPageSize, current_page: 1, last_page: 1 } };
    }

    return { data, meta };
  }

  private normalizarLlegada(raw: Record<string, unknown>): Llegadas {
    const payload = this.asRecord(raw['payload'] ?? raw);
    const pasajerosRaw = raw['numeroPasajero'] ?? payload['numeroPasajero'] ?? raw['numero_pasajero'];
    const horaRaw = String(raw['horaLlegada'] ?? payload['horaLlegada'] ?? raw['hora_llegada'] ?? '');

    return {
      id: String(raw['id'] ?? raw['solicitudId'] ?? payload['id'] ?? ''),
      idTipollegada:
        Number(
          raw['idTipollegada'] ??
            raw['idTipoLlegada'] ??
            raw['tipoLlegada'] ??
            payload['idTipollegada'] ??
            payload['idTipoLlegada'] ??
            0
        ) || undefined,
      idDespacho:
        raw['idDespacho'] != null && raw['idDespacho'] !== ''
          ? Number(raw['idDespacho'])
          : payload['idDespacho'] != null && payload['idDespacho'] !== ''
            ? Number(payload['idDespacho'])
            : null,
      terminalLlegada: String(
        raw['terminalLlegada'] ?? payload['terminalLlegada'] ?? raw['terminal_llegada'] ?? ''
      ),
      horaLlegada: horaRaw ? horaRaw.slice(0, 5) : '',
      fechaLlegada: String(
        raw['fechaLlegada'] ??
          payload['fechaLlegada'] ??
          raw['fecha_llegada'] ??
          raw['fechaCreacion'] ??
          ''
      ),
      numeroPasajero:
        pasajerosRaw != null && String(pasajerosRaw) !== '' ? Number(pasajerosRaw) : null,
      nitEmpresaTransporte: String(
        raw['nitEmpresaTransporte'] ??
          payload['nitEmpresaTransporte'] ??
          raw['nit_empresa_transporte'] ??
          raw['nitVigilado'] ??
          ''
      ),
      fuenteDato: String(
        raw['fuenteDato'] ?? payload['fuenteDato'] ?? raw['fuente_dato'] ?? ''
      ),
      placa: String(raw['placa'] ?? payload['placa'] ?? ''),
    };
  }

  private leerSolicitudIds(): number[] {
    try {
      const raw = sessionStorage.getItem(IDS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter((id) => id > 0) : [];
    } catch {
      return [];
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
