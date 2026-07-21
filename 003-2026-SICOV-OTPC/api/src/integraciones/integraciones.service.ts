import { Injectable, Logger } from '@nestjs/common'

export interface RespuestaExterna {
  ok: boolean
  radicado?: string
  error?: string
}

/**
 * Punto único de contacto con las APIs de Supertransporte (despachos, Vigía, integradora).
 * En modo "stub" simula respuestas; en modo "real" se implementa el fetch con credenciales.
 * La UI y las colas no cambian al pasar de stub a real.
 */
@Injectable()
export class IntegracionesService {
  private readonly log = new Logger('Integraciones')
  private get modo() {
    return process.env.INTEGRACIONES_MODO ?? 'stub'
  }

  async enviarDespacho(payload: Record<string, unknown>): Promise<RespuestaExterna> {
    if (this.modo === 'real') {
      // TODO producción: POST a `${process.env.URL_DESPACHOS}/despachosempresa` con token.
      throw new Error('Integración real no configurada.')
    }
    // Stub: ~85% éxito, resto error de validación simulado.
    await this.demora(300)
    const exito = this.hash(JSON.stringify(payload)) % 100 < 85
    return exito
      ? { ok: true, radicado: `88${(this.hash(JSON.stringify(payload)) % 100000).toString().padStart(5, '0')}` }
      : { ok: false, error: 'Error 422 · validación externa' }
  }

  async enviarLlegada(payload: Record<string, unknown>): Promise<RespuestaExterna> {
    return this.enviarDespacho(payload)
  }

  async verificarTokenVigia(token: string): Promise<{ valido: boolean; documento: string; nombre: string }> {
    if (this.modo === 'real') {
      // TODO producción: GET `${process.env.URL_VIGIA}/autenticacion/token/verificar`.
      throw new Error('Integración real no configurada.')
    }
    await this.demora(200)
    return { valido: token.trim().length > 0, documento: '900853057', nombre: 'Sesión Vigía' }
  }

  async resumenIntegradora(placa: string) {
    if (this.modo === 'real') throw new Error('Integración real no configurada.')
    await this.demora(250)
    return {
      placa,
      nivelServicio: 'Intermunicipal',
      despachosMes: 42,
      llegadasMes: 39,
      novedadesActivas: 1,
      mantenimientos: 6,
      estadoVigilado: 'Contrato vigente',
    }
  }

  private demora(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }
  private hash(s: string) {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return h
  }
}
