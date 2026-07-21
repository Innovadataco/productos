# Quickstart — 001-auth-despacho-doble-token

> Levantar y probar la P1 **en modo stub** (sin APIs productivas). Requiere Docker + Node ≥22.

## 1. Infraestructura (BD aislada del 003)
```bash
cd 003-2026-SICOV-OTPC
docker compose up -d                 # crea 003-2026-sicov-otpc-db-1 en :5434
docker ps | grep 003-2026-sicov      # verificar healthy
```

## 2. Variables de entorno
```bash
cp .env.example .env
# Editar .env: JWT_SECRET (≥32), DB_PASSWORD.
# DEJAR INTEGRACIONES_MODO=stub y SUPERTRANSPORTE_HABILITADO=false  (guardarraíl)
```

## 3. Dependencias, esquema y datos demo
```bash
npm install
npm run db:migrate:dev               # aplica init_sicov_p1 (esquema sicov)
npm run db:seed                      # roles 1/2/3, admin, vigilado, subusuario, despachos demo
```

## 4. Levantar app + worker
```bash
npm run dev        # terminal 1 → http://localhost:5010
npm run worker     # terminal 2 → worker table-driven de despachos
```

## 5. Pruebas de humo (modo stub)

### 5.1 Login único (US1)
1. Ir a `http://localhost:5010/login`. **No debe existir pestaña "Vigía"** (solo usuario/contraseña).
2. Entrar como admin demo (`admin` / clave del seed). → sesión activa, cookie httpOnly, menú por rol.
3. Entrar como subusuario rol 3 → hereda token/NIT del administrador (verificable al reportar).
4. Credenciales inválidas → mensaje genérico; **un 5xx NO inicia sesión demo** (bug 3 corregido).
5. Sesión expirada (borrar cookie) → al pedir recurso protegido, redirige a `/login`, **no muestra datos demo** (bug 4 corregido).

### 5.2 Despacho con doble token (US2, stub)
1. Registrar un despacho (payload demo). → se crea fila en `tbl_despachos_solicitudes` (`estado=pendiente`).
2. El worker la procesa: en stub, el `ClienteStub` simula la respuesta y arma las **3 cabeceras** internamente (verificable en logs del worker: `Authorization`/`token`/`documento`, sin imprimir el valor de los tokens).
3. La solicitud pasa a `estado=procesado`, con `idDespachoExterno` y `respuestaExterna`.
4. Forzar un fallo (stub configurable) → `estado=fallido`, `reintentos` correcto; el botón **"Reintentar"** del log de cola funciona (bug 2) y re-encola con `reintentos=0` (bug 1).
5. KPI "Despachos hoy" del dashboard cuenta **solo los de hoy** (America/Bogota), no el histórico (bug 5 corregido).

### 5.3 Verificar que NO se toca la Super
- Con `INTEGRACIONES_MODO=stub`, ninguna petición sale a `*.supertransporte.gov.co` (verificable: sin red / logs). El `ClienteHttp` real ni siquiera se instancia.

## 6. Calidad (gate de las 5 reglas de oro)
```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run test             # vitest (solo stubs)
npm run build            # next build
```

## 7. Apagar sin perder datos
```bash
docker compose stop      # libera RAM; conserva el volumen 003-2026-sicov-otpc_db_data
```
