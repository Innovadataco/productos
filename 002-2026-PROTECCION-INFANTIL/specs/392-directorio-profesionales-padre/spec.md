# SPEC-392 · L3 · Directorio de profesionales — la vista del padre

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 · **Origen**: brief A-75 §7 (lote L3, aprobado por Jelkin 03-09) + veredicto CEO 07:10.

## Para qué

El padre se presenta, marca urgencia, ve **quiénes existen** (baraja aleatoria) y elige perfil. **NO reserva cita** — la reserva es L4. La tesis del brief es la clave del diseño:

> *«El directorio es abierto: no se esconde detrás del pago. Esconderlo convertiría la suscripción en "pago un mes, saco el teléfono, me voy".»* — brief §1.

Traducción a código: rol **PARENT autenticado**, exento del guardián de vigencia. Padre gratis puede ver la red; el muro cae solo al reservar (L4).

## Alcance

### UI · 3 páginas nuevas (área padre)

1. **`/dashboard/padre/profesionales`** · presentación + urgencia + canales oficiales (141, CAI Virtual, Te Protejo — `CanalesOficiales` reusado).
2. **`/dashboard/padre/profesionales/directorio`** · baraja aleatoria + filtros (ciudad / especialidad / modalidad).
3. **`/dashboard/padre/profesionales/[id]`** · perfil con la **tarifa por delante** ("$120.000 · 50 min") y el sello «Nuevo en la red». Botón "Solicitar cita" DESACTIVADO — dice que llega en L4.

### API · 3 endpoints

1. **`GET /api/padre/profesionales?seed&ciudadId?&especialidad?&modalidad?`** — lista, solo `estado=ACTIVO`.
2. **`GET /api/padre/profesionales/facetas`** — ciudades + especialidades derivadas de los perfiles ACTIVO.
3. **`GET /api/padre/profesionales/[id]`** — perfil detallado (404 fuera de ACTIVO).

### DAL

- **`PerfilProfesionalRepository`** con `listarActivos`, `obtenerPublicoPorId`, `facetas`.
- `SELECT` allowlist ESTRICTO (candado H-2, ver abajo).

### Guardias + menú

- `guardias.ts` · `vigencia.PARENT.exentas`: añadidas `/dashboard/padre/profesionales` y `/api/padre/profesionales`.
- `nav-items.ts` · nueva entrada "Encontrar psicólogo" en `PADRE_NAV_ITEMS` entre "Reportar" y "Suscripción".

## Candados

### H-2 · Ley 2375/2024 · el test más importante del PR

> Veredicto CEO 07:10: *«Si el teléfono viaja en el JSON del directorio, cualquiera abre DevTools, lo copia, llama por fuera y PI no se entera de nada. Se cae la plata, la métrica y la razón de ser del frente.»*

`SELECT` en `perfil-profesional.ts` es una allowlist explícita: fuera quedan `numeroTarjetaProfesional`, `datosFacturacion` (internos del PerfilProfesional) y **todo el contacto** del `Usuario` base — `email`, `telefono`, `documentoTipo`, `documentoNumero`, `fechaNacimiento`, `apellidos`, `nombre`. El `route.test.ts` siembra centinelas literales (`"NADIE-DEBE-VER-EL-EMAIL@..."`, `"NADIE-DEBE-VER-LA-TARJETA-..."`) en cada campo prohibido y `JSON.stringify(payload)` no debe contenerlas en NINGUNO de los tres endpoints. Si un cambio futuro los deja pasar, saltan literal en el mensaje de fallo.

Verificaciones de `VerificacionProfesional` (`resultado`, `checklist`, `autorizacionArchivoUrl`, `notaInterna`, `avisoVencimientoEnviadoEn`) también en el barrido — L2 los agregará y este test los caza si algún join los expone.

### H-1 · Directorio abierto ≠ público

El directorio es **PARENT autenticado**, exento del guardián de vigencia. NO es una ruta pública sin login — el brief pide que el padre se presente, y eso requiere sesión. Lo que se salta es el muro de suscripción, no la autenticación.

### H-4 · Baraja sembrada por SESIÓN, no por request

Semilla en `sessionStorage` (client). El endpoint exige `?seed=` y ordena con `sha256(id + seed)` (helper `directorio-shuffle.ts`). Mismo `seed` → mismo orden mientras el padre navega y filtra; se re-baraja al abrir una pestaña nueva. Sin `seed`, 400.

### H-3 · Sello «Nuevo en la red» siempre en L3

`EncuestaPrimeraCita` llega en L6 — hoy no hay calificaciones. Todos los perfiles arrancan con el sello. El umbral para pintar estrellas se decide en L6 con datos reales.

## Fuera de alcance (T-fuera-scope)

- Reservar cita (`SolicitudCita`, franjas, 48 h) — L4.
- Panel del profesional — L5.
- Encuesta — L6.
- Pagos — L7.
- Auditoría de acceso a la ficha de verificación (admin) — L2.
- Storage protegido de la autorización firmada — L1b.

## Impacto en arquitectura: sí (mínimo)

3 rutas UI + 3 endpoints. Guardián de vigencia PARENT ampliado. Sin migración (el modelo llegó en SPEC-388a). Regenerados `02-roles-capacidades.md` y `03-pantallas.md`.

## Cómo se probó

- `npx tsc --noEmit` — limpio.
- 6 tests unit (baraja determinística) — verdes.
- 4 tests unit (tarjeta) — verdes.
- 10 tests integración (los tres endpoints, con el barrido H-2 en cada uno) — verdes.
- `arch:check` — verde tras regenerar los dos artefactos.
- `eslint` — 0 errores.
