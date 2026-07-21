import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { DespachosService } from '../../despachos/services/despachos.service';
import { RegistroLlegadaIntegracion } from '../../despachos/models/Integracion';
import { Salida } from './salidas.models';

@Injectable({ providedIn: 'root' })
export class SalidasService {
  private readonly despachos = inject(DespachosService);

  listar(nit?: string) {
    return this.despachos.listarDespachos(nit).pipe(
      map((resp) => ({ array_data: this.normalizarLista(resp) }))
    );
  }

  buscarPorPlaca(placa: string, fechaSalida?: string) {
    return this.despachos.consultarSalidaPorPlaca(placa, fechaSalida);
  }

  obtener(id: number) {
    return this.despachos.obtenerDespacho(id);
  }

  normalizarSalida(raw: Record<string, unknown>): Salida {
    const vehiculo = raw['vehiculo'] as Record<string, unknown> | undefined;
    const vehiculos = raw['vehiculos'] as Record<string, unknown>[] | undefined;
    return {
      id: Number(raw['id'] ?? raw['idDespachoExterno'] ?? 0) || undefined,
      nitEmpresaTransporte: String(raw['nitEmpresaTransporte'] ?? raw['nit_empresa_transporte'] ?? ''),
      razonSocial: String(raw['razonSocial'] ?? raw['razon_social'] ?? ''),
      fechaSalida: String(raw['fechaSalida'] ?? raw['fecha_salida'] ?? ''),
      horaSalida: String(raw['horaSalida'] ?? raw['hora_salida'] ?? ''),
      numeroPasajero: Number(raw['numeroPasajero'] ?? raw['numero_pasajero'] ?? 0) || undefined,
      placa: String(raw['placa'] ?? vehiculo?.['placa'] ?? vehiculos?.[0]?.['placa'] ?? ''),
      fuenteDato: String(raw['fuenteDato'] ?? raw['fuente_dato'] ?? ''),
      llegadas: (raw['llegadas'] as unknown[]) ?? [],
      estado: raw['estado'] as boolean | undefined,
    };
  }

  private normalizarLista(resp: unknown): Salida[] {
    const root = resp as Record<string, unknown>;
    const raw = root?.['array_data'] ?? root?.['data'] ?? root?.['obj'] ?? [];
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item) => this.normalizarSalida(item as Record<string, unknown>));
  }

  registrarLlegada(payload: RegistroLlegadaIntegracion) {
    return this.despachos.registrarLlegadaIntegracion(payload);
  }
}
