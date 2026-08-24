> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Plan de implementación: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100)

## Resumen

Crear panel `/dashboard/perfil/notificaciones` para que cada usuario gestione sus preferencias del motor, generalizar `CentroNotificaciones.tsx` a multi-rol y asegurar que el motor consulte preferencias antes de programar notificaciones no transaccionales.

## Cambios de código

### 1. API de preferencias

#### 1.1 `src/app/api/notificaciones/preferencias/route.ts`

`GET`: devuelve reglas aplicables al rol del usuario con preferencia efectiva.
`PATCH`: actualiza preferencias (rechaza si obligatoria).

#### 1.2 `src/lib/notificaciones/preferencias.ts` (SPEC-201)

Extender con:

```ts
export async function obtenerPreferenciasUsuario(usuarioId: string, rol: string): Promise<...>;
export async function actualizarPreferencia(usuarioId: string, eventoRegla: string, habilitado: boolean): Promise<...>;
export async function esEventoHabilitado(usuarioId: string, evento: string, canal: CanalNotificacion): Promise<boolean>;
```

### 2. Centro de notificaciones unificado

#### 2.1 `src/components/modules/notificaciones/CentroNotificaciones.tsx`

Nuevo componente generalizado (reemplaza o envuelve al de colegio). Recibe `rol` opcional o lo obtiene de contexto.

#### 2.2 `src/app/api/notificaciones/route.ts`

Endpoint unificado que lista notificaciones del motor para el usuario autenticado:

```ts
GET /api/notificaciones?page=&pageSize=&soloNoLeidas=
```

#### 2.3 `src/lib/dal/repositories/notificacion.ts`

Añadir métodos para listar por `destinatarioUsuarioId` con paginación.

### 3. Panel de preferencias UI

#### 3.1 `src/app/dashboard/perfil/notificaciones/page.tsx`

Página del perfil.

#### 3.2 `src/components/modules/perfil/PreferenciasNotificaciones.tsx`

Componente con agrupación por categoría, toggles, indicadores de obligatoriedad.

### 4. Integración con motor

#### 4.1 `src/lib/notificaciones/motor.ts`

En `programar`, antes de crear notificación no obligatoria, consultar `esEventoHabilitado(usuarioId, evento, canal)`.

### 5. Reemplazo de CentroNotificaciones existente

#### 5.1 Refactor

- Reemplazar usos de `src/components/modules/colegio/CentroNotificaciones.tsx` por el nuevo componente generalizado, o hacer que el antiguo re-exporte el nuevo.
- Ajustar `src/app/api/colegio/notificaciones/**` si se unifica la bandeja, o mantenerlos como legacy.

### 6. Tests

- `src/app/api/notificaciones/preferencias/route.test.ts`
- `src/lib/notificaciones/preferencias.test.ts`
- Tests del componente `PreferenciasNotificaciones`.

### 7. Documentación

- `specs/203-preferencias-notificaciones-usuario/quickstart.md`
- `specs/203-preferencias-notificaciones-usuario/data-model.md` (sin cambios de schema).

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- CI verde 6/6.
