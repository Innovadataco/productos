# Contratos de API / Jobs — SPEC-213

## Worker interno

El worker `scripts/worker-vigencia-pagos.mjs` no expone endpoint HTTP. Se ejecuta como proceso independiente.

### Ejecución manual

```bash
node scripts/worker-vigencia-pagos.mjs [--now]
```

- `--now`: ignora la hora configurada y corre inmediatamente (útil para pruebas manuales).
- Salida: código 0 si adquiere lock y termina; código 2 si ya hay otro worker activo.

### Programación Docker Compose

El servicio `pi-vigencia` corre el worker. El propio worker maneja su scheduling interno (espera hasta `pagos.vigencia.hora_corrida`) o puede ser invocado por cron externo.

## API interna: `vigencia.service.ejecutarCorrida()`

### Signature (TypeScript)

```typescript
async function ejecutarCorrida(opciones?: {
  forzarFechaBogota?: string; // ISO date, solo para tests
}): Promise<{
  transiciones: Array<{
    suscripcionId: string;
    estadoAnterior: EstadoSuscripcion;
    estadoNuevo: EstadoSuscripcion;
    evento: string;
  }>;
  eventosProgramados: number;
}>;
```

### Comportamiento

1. Verifica idempotencia (`pagos.vigencia.ultima_corrida`).
2. Lista candidatas:
   - `ACTIVA` con `fechaFin <= hoy`.
   - `EN_GRACIA` con `fechaCorteProgramado <= hoy`.
   - `ACTIVA` con `esFreemium=true` y `freemiumFechaFin < hoy`.
3. Ejecuta transiciones.
4. Registra `AuditLog`.
5. Emite/programa eventos motor notif.
6. Guarda `pagos.vigencia.ultima_corrida`.

## Eventos emitidos (catálogo §10 del BRIEF)

| Evento | Condición |
|---|---|
| `suscripcion.creada` | No aplica al worker (se emite al crear suscripción). |
| `suscripcion.freemium.T_menos_7` | `esFreemium=true`, faltan 7 días. |
| `suscripcion.freemium.T_menos_1` | `esFreemium=true`, falta 1 día. |
| `suscripcion.freemium.terminado` | `esFreemium=true` y `freemiumFechaFin < hoy`. |
| `suscripcion.por_vencer.T_menos_5` | `ACTIVA`, faltan 5 días para `fechaFin`. |
| `suscripcion.por_vencer.T_menos_1` | `ACTIVA`, falta 1 día. |
| `suscripcion.vencida.T_0` | `ACTIVA → EN_GRACIA`. |
| `suscripcion.gracia.T_mas_2` | `EN_GRACIA`, día 2 de gracia. |
| `suscripcion.cortada.T_mas_3` | `EN_GRACIA → SUSPENDIDA`. |
| `pago.recibido` | No aplica al worker. |
| `pago.autorizado` | No aplica al worker. |
| `pago.rechazado` | No aplica al worker. |
| `referido.registrado` | No aplica al worker. |
| `referido.recompensa.otorgada` | No aplica al worker. |
| `referido.tope_anual` | No aplica al worker. |
| `bono.aplicado` | No aplica al worker. |
| `suscripcion.reactivada` | No aplica al worker (manual). |
| `suscripcion.cancelada` | No aplica al worker (manual). |
