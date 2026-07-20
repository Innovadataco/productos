# Quickstart — Spec 040: Aislamiento del comité a su Bandeja

## Prerrequisitos

- Repo en rama `feature/001-scaffolding`.
- Dependencias instaladas: `npm install`.
- App construida con `rm -rf .next && npm run build`.
- `./scripts/dev-restart.sh` ejecutado (un solo worker).
- Tener usuarios de cada rol: `ADMIN`, `SCHOOL_ADMIN`, `COMITE_VALIDACION`, `OPERADOR`.

## Verificación del aislamiento del comité (US1)

### 1. COMITE_VALIDACION solo ve "Bandeja"

Iniciar sesión como comité y abrir `/dashboard/admin/comite`:

```bash
curl -s -c /tmp/c-comite.txt -b /tmp/c-comite.txt -X POST http://localhost:5005/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"comite@example.com","password":"PASSWORD"}'
```

Abrir en navegador: `http://localhost:5005/dashboard/admin/comite`.

Esperado: en el SubNav se ve únicamente la pestaña **"Bandeja"**. Las pestañas "Gestión" y "Auditoría" no aparecen.

### 2. ADMIN/SCHOOL_ADMIN ven las 3 pestañas

Iniciar sesión como admin o school_admin y abrir `/dashboard/admin/comite`.

Esperado: se ven las pestañas **"Bandeja", "Gestión" y "Auditoría"**.

### 3. Redirección por proxy de rutas admin-only

Con cookie de `COMITE_VALIDACION`:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -I -b /tmp/c-comite.txt \
  http://localhost:5005/dashboard/admin/comite/gestion

# Esperado: 307 http://localhost:5005/dashboard/admin/comite

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -I -b /tmp/c-comite.txt \
  http://localhost:5005/dashboard/admin/comite/auditoria

# Esperado: 307 http://localhost:5005/dashboard/admin/comite
```

Con cookie de `ADMIN` o `SCHOOL_ADMIN`:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -I -b /tmp/c-admin.txt \
  http://localhost:5005/dashboard/admin/comite/gestion

# Esperado: 200
```

### 4. Ruta base del comité sigue accesible

Con cookie de `COMITE_VALIDACION`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -I -b /tmp/c-comite.txt \
  http://localhost:5005/dashboard/admin/comite

# Esperado: 200
```

## Verificación del flujo del comité (US2)

### Requisitos

- Un operador con un caso que pueda escalar al comité.
- Un usuario `COMITE_VALIDACION` con sesión activa.

### Pasos

1. Como operador, abrir un caso que esté en un estado escalable y hacer clic en **"Escalar a comité"**.
2. Como comité, abrir `/dashboard/admin/comite`.
   - Esperado: en la pestaña "Bandeja", sección "Pendientes", aparece el caso escalado.
3. Como comité, hacer clic en **"Tomar caso"**.
   - Esperado: el caso pasa a la sección "Míos".
4. Como comité, abrir el caso y seleccionar **"Finalizar" → "CORREGIDO"**.
   - Esperado: el caso cambia de estado y desaparece de la bandeja activa.

### Si algo falla

- Si el flujo no se puede completar y no se puede arreglar con un cambio acotado, documentar el bug en `docs/cierre-040.md` como deuda técnica. No se rediseña la bandeja en este spec.

## Validación automática

```bash
npm run lint
npx tsc --noEmit
npm run test
```

## Limpieza y reinicio

```bash
rm -rf .next
npm run build
./scripts/dev-restart.sh
```
