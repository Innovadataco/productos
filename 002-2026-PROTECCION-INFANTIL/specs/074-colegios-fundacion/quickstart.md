# Quickstart: Módulo Colegios — Fase 1: Fundación (Spec 074)

**Prerequisites**: Docker, Node.js >=22, PostgreSQL corriendo (`docker compose up -d db`), migraciones aplicadas y seed ejecutado. La Fase 0 (Spec 073) debe estar aplicada para contar con `Departamento` y `Ciudad.departamentoId`. **Importante**: hacer un dump de respaldo de la BD antes de ejecutar migraciones.

---

## 1. Backup de la base de datos

```bash
pg_dump -h localhost -p 5433 -U proteccion -d proteccion_infantil > /tmp/backup-pre-074.dump
```

**Esperado**: archivo de backup creado sin errores.

---

## 2. Aplicar migración aditiva

```bash
npx prisma migrate deploy
```

**Esperado**: la migración `add_colegio` se aplica sin pérdida de datos.

---

## 3. Crear un colegio como admin

1. Iniciar sesión como admin en `http://localhost:5005/login`.
2. Ir al panel de administración → módulo Colegios (`/dashboard/admin/colegios`).
3. Hacer clic en "Nuevo colegio" y completar:
   - Nombre de la institución.
   - País, departamento (opcional) y ciudad.
   - Dirección.
   - Datos del representante legal.
   - Fechas de inicio y fin de servicio.
   - Tipo de periodo (Mensual/Semestral/Anual).
   - Email del SCHOOL_ADMIN (único en la plataforma).
4. Guardar.

**Esperado**: el sistema crea el colegio, el usuario SCHOOL_ADMIN con contraseña temporal y registra `COLEGIO_CREADO` en `AuditLog`. Si el email de bienvenida no se envía, la pantalla muestra la contraseña temporal.

---

## 4. Login institucional como SCHOOL_ADMIN

1. Cerrar sesión de admin.
2. Ir a `http://localhost:5005/login`.
3. Ingresar con el email del SCHOOL_ADMIN y la contraseña temporal.
4. Cambiar la contraseña obligatoriamente.

**Esperado**: el sistema redirige a `/dashboard/colegio` y la interfaz muestra el acento verde (botones, focos, gradientes). El nombre del colegio y los datos del representante legal son visibles.

---

## 5. Verificar vigencia del servicio

### Caso A: servicio vigente

- El SCHOOL_ADMIN dentro del periodo puede navegar y usar `/dashboard/colegio` y `/api/me/colegio`.

### Caso B: servicio vencido

1. Como admin, editar el colegio y poner `finServicio` en el pasado.
2. Intentar refrescar `/dashboard/colegio` como SCHOOL_ADMIN.

**Esperado**: el proxy redirige a `/login` o a una página de servicio no vigente con el mensaje "Servicio no vigente, contacte al administrador".

### Caso C: servicio aún no inicia

1. Como admin, poner `inicioServicio` en el futuro.
2. Intentar login.

**Esperado**: el login rechaza con el mensaje de servicio no vigente.

---

## 6. Verificar que el colegio NO puede reportar

1. Como SCHOOL_ADMIN autenticado, intentar acceder a `http://localhost:5005/reportar`.

**Esperado**: redirección a `/dashboard/colegio` (o página de no permitido). No se puede crear un reporte desde la cuenta institucional.

2. Como SCHOOL_ADMIN, hacer una petición manual:

```bash
curl -X POST http://localhost:5005/api/reportes \
  -H "Content-Type: application/json" \
  -b "token=<tu-token>" \
  -d '{"identificador":"test","plataforma":"discord","texto":"...","fechaIncidente":"...","ciudad":"Bogotá","pais":"Colombia"}'
```

**Esperado**: 403 con mensaje de permisos insuficientes.

3. Verificar que un usuario anónimo y un PARENT aún pueden reportar normalmente.

---

## 7. Verificar aislamiento de SCHOOL_ADMIN

1. Como SCHOOL_ADMIN autenticado, intentar acceder a:
   - `http://localhost:5005/dashboard/admin`
   - `http://localhost:5005/dashboard/admin/operadores`
   - `http://localhost:5005/dashboard/admin/comite`
   - `http://localhost:5005/dashboard/admin/estadisticas`
   - `http://localhost:5005/mis-reportes`
   - `http://localhost:5005/dashboard/circulo-confianza`

**Esperado**: redirección a `/dashboard/colegio` o página de no permitido en todos los casos.

2. Como SCHOOL_ADMIN, hacer peticiones a endpoints de admin:

```bash
curl -s -b "token=<tu-token>" http://localhost:5005/api/admin/operadores
curl -s -b "token=<tu-token>" http://localhost:5005/api/admin/comite/pendientes
curl -s -b "token=<tu-token>" http://localhost:5005/api/admin/reportes-revision
curl -s -b "token=<tu-token>" http://localhost:5005/api/admin/estadisticas
```

**Esperado**: 403 en todos los casos.

3. Verificar que ADMIN, OPERADOR, COMITE y PARENT conservan sus accesos habituales.

---

## 8. Ejecutar tests y build

```bash
npm run test
npm run build
```

**Meta**: 605+ tests verdes, build sin errores.

---

## 9. Rollback si algo falla

Si se detecta regresión, restaurar desde el backup:

```bash
psql -h localhost -p 5433 -U proteccion -d proteccion_infantil < /tmp/backup-pre-074.dump
```

**Nota**: nunca usar `prisma migrate reset` en este proyecto.
