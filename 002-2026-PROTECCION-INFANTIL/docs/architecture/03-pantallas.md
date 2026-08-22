> GENERADO por `scripts/arch/generar-pantallas.ts` — no editar a mano.
> Fuentes: `src/app/**`, `src/lib/proxy.ts`, `src/lib/nav-items.ts`.
> Regenerar: `npx tsx scripts/arch/generar-pantallas.ts` (o `npm run arch:check` para verificar).

# 03 · Pantallas por rol y transiciones

78 páginas (`page.tsx`) clasificadas por quién las alcanza según la
puerta real (`proxy()` ejecutado con la sesión canónica; segmentos `[x]` evaluados
con un valor muestra fijo — al proxy solo le importa el prefijo).

## Home por rol (`homeForRole` de `proxy.ts`)

| Rol | Home (destino de los redirects) |
| --- | --- |
| ADMIN, OPERADOR (por defecto) | `/dashboard/admin` |
| COMITE_CONVIVENCIA | `/dashboard/colegio/comite` |
| COMITE_VALIDACION | `/dashboard/admin/comite` |
| PARENT | `/dashboard` |
| SCHOOL_ADMIN | `/dashboard/colegio` |

Sin sesión, toda ruta protegida redirige a `/login` (página) o 401 (API).

## Pantallas y quién las alcanza

| Pantalla | Roles que la alcanzan | Bloqueados (veredicto de la puerta) |
| --- | --- | --- |
| `/` | ADMIN, OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, PARENT, ANONIMO | COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/cambiar-password` | ADMIN, OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT | ANONIMO (redirigir→/login) |
| `/dashboard` | PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard-publico` | ADMIN, OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, PARENT, ANONIMO | COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/dashboard/admin` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/anti-abuso` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/colegios` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/colegios/[id]/estructura` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/colegios/nuevo` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/comite` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/comite/apelaciones` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/comite/auditoria` | ADMIN | OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/dashboard)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/comite/gestion` | ADMIN | OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/dashboard)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/configuracion` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/dataset-entrenamiento` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/estadisticas` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/estadisticas/clasificacion` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/estadisticas/motor` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/estadisticas/operacion` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/ia` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/monitoreo/worker` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/operadores` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/operadores/[id]` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/operadores/asignar` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/operadores/auditoria` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/operadores/gestion` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/operadores/modelo` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/padres` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/padres/[id]/circulo` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/spam` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/usuarios` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/usuarios/[id]` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/usuarios/admins` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/usuarios/comite-convivencia` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/usuarios/comite-validacion` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/usuarios/operadores` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/admin/usuarios/rectores` | ADMIN, OPERADOR, COMITE_VALIDACION | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>PARENT (redirigir→/)<br>ANONIMO (redirigir→/login) |
| `/dashboard/apelaciones` | PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/circulo-confianza` | PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/alertas` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/alertas/[id]` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/alumnos/[id]` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/analisis/comparativa` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/auditoria` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/comite` | SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/comite/casos` | SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/comite/casos/[id]` | SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/comite/estadisticas` | SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/comite/integrantes` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/confianza` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/configuracion` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/cursos` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/cursos/[id]` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/cursos/carga` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/cursos/nuevo` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/cursos/unificado` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/estadisticas` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/materias` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/onboarding` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/profesores` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/profesores/[id]` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/colegio/tablero` | SCHOOL_ADMIN, PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/dashboard/mis-reportes/[id]` | PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/docs` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/docs/operar` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/docs/tecnico` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/login` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/mis-reportes` | PARENT | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite)<br>ANONIMO (redirigir→/login) |
| `/offline` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/privacidad` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/recuperar` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/recuperar/[token]` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/registro` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/reportar` | PARENT, ANONIMO | ADMIN (redirigir→/dashboard/admin)<br>OPERADOR (redirigir→/dashboard/admin)<br>COMITE_VALIDACION (redirigir→/dashboard/admin/comite)<br>SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/seguimiento` | ADMIN, OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, PARENT, ANONIMO | COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |
| `/terminos` | ADMIN, OPERADOR, COMITE_VALIDACION, PARENT, ANONIMO | SCHOOL_ADMIN (redirigir→/dashboard/colegio)<br>COMITE_CONVIVENCIA (redirigir→/dashboard/colegio/comite) |

## Grafo de transiciones (redirects de la puerta)

```mermaid
flowchart LR
    anon[sin sesión] -->|ruta protegida| login[/login]
    bloqueado_ADMIN__OPERADOR______________[ruta no permitida] -->|ADMIN, OPERADOR (por defecto)| ADMIN__OPERADOR______________([/dashboard/admin])
    bloqueado_COMITE_CONVIVENCIA[ruta no permitida] -->|COMITE_CONVIVENCIA| COMITE_CONVIVENCIA([/dashboard/colegio/comite])
    bloqueado_COMITE_VALIDACION[ruta no permitida] -->|COMITE_VALIDACION| COMITE_VALIDACION([/dashboard/admin/comite])
    bloqueado_PARENT[ruta no permitida] -->|PARENT| PARENT([/dashboard])
    bloqueado_SCHOOL_ADMIN[ruta no permitida] -->|SCHOOL_ADMIN| SCHOOL_ADMIN([/dashboard/colegio])
```
