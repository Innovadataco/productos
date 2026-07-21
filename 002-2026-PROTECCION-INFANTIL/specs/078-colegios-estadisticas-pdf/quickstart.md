# Quickstart: Colegios · Fase 5 — Estadísticas e informe PDF institucional

## Requisitos previos

- Estar en la rama `feature/001-scaffolding`.
- El proyecto corriendo en `:5005` tras `./scripts/dev-restart.sh`.
- Tener el seed aplicado con las 4 cuentas de trabajo (admin, padre, operador, comité) y un colegio con cursos, alumnos e identificadores.

## Pasos

### 1. Crear un colegio y su SCHOOL_ADMIN (como admin)

```bash
curl -X POST http://localhost:5005/api/admin/colegios \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Colegio de Prueba Fase 5",
    "paisId": "<id-colombia>",
    "departamentoId": "<id-antioquia>",
    "ciudadId": "<id-medellin>",
    "direccion": "Calle 123",
    "representanteLegalNombre": "Representante Legal",
    "representanteLegalIdentificacion": "123456789",
    "representanteLegalEmail": "rep-fase5@example.com",
    "representanteLegalTelefono": "3001234567",
    "inicioServicio": "2026-01-01T00:00:00.000Z",
    "finServicio": "2026-12-31T23:59:59.000Z",
    "tipoPeriodo": "ANUAL"
  }'
```

> Guarda el `id` del colegio y el `email` del SCHOOL_ADMIN generado. Revisa la bandeja de entrada de Mailpit si es local.

### 2. Login como SCHOOL_ADMIN y obtener cookie

Usa el email y la contraseña temporal enviada por correo, o establece una vía el endpoint de admin.

```bash
curl -X POST http://localhost:5005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email-admin-colegio>","password":"<password>"}' \
  -c /tmp/cookies-fase5.txt
```

### 3. Crear cursos y alumnos con identificadores

Usa la UI o los endpoints de Fase 2 (`/api/colegio/cursos`, `/api/colegio/cursos/[id]/alumnos`, `/api/colegio/alumnos/[id]/identificadores`).

### 4. Generar alertas (opcional)

Crear un reporte anónimo con un identificador registrado para un alumno del colegio, esperar a que el worker lo procese, y verificar que aparece en `/api/colegio/alertas`.

### 5. Ver estadísticas

```bash
curl -b /tmp/cookies-fase5.txt http://localhost:5005/api/colegio/estadisticas
```

Respuesta esperada:

```json
{
  "colegioId": "...",
  "colegioNombre": "Colegio de Prueba Fase 5",
  "totales": {
    "cursos": 2,
    "alumnos": 5,
    "identificadores": 7,
    "alertas": 1
  },
  "porCurso": [
    { "cursoId": "...", "nombre": "5A", "alumnos": 3, "identificadores": 4, "alertas": 1 }
  ]
}
```

### 6. Descargar PDF

```bash
curl -b /tmp/cookies-fase5.txt \
  http://localhost:5005/api/colegio/estadisticas/pdf \
  -o /tmp/estadisticas-fase5.pdf
```

Verificar que el archivo existe y contiene el nombre del colegio, la fecha y la tabla por curso.

```bash
file /tmp/estadisticas-fase5.pdf
ls -lh /tmp/estadisticas-fase5.pdf
```

### 7. Verificar UI

Abrir `http://localhost:5005/dashboard/colegio/estadisticas` autenticado como SCHOOL_ADMIN. Confirmar:

- Tarjetas con totales.
- Tabla de desglose por curso.
- Botón "Descargar PDF" que genera el archivo.
- En el dashboard de colegio, el link de "Estadísticas" ya no dice "Próximamente".

### 8. Verificar aislamiento

Intentar acceder al endpoint con la cookie de otro rol (admin, operador, comité, padre). Debe devolver 403.

```bash
curl -b /tmp/cookies-admin.txt http://localhost:5005/api/colegio/estadisticas
# 403
```

### 9. Limpieza de datos de prueba (conservar las 4 cuentas de trabajo)

```bash
# Desde Prisma Studio o SQL directo, borrar solo los datos de la fase 5:
# - colegio creado para prueba
# - cursos, alumnos, identificadores, alertas asociadas
# Nunca borrar los usuarios admin, padre, operador, comité.
```

O usar el endpoint de admin si existe para desactivar el colegio de prueba.

## Verificación rápida de tests

```bash
npx tsc --noEmit
npm run lint
npx vitest run src/app/api/colegio/estadisticas/route.test.ts
npm run build
./scripts/dev-restart.sh
```
