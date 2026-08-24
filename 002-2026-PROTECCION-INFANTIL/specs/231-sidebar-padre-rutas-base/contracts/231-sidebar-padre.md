# Contratos — SPEC-231

## Rutas de página

| Ruta | Método | Rol requerido | Respuesta |
|---|---|---|---|
| `/dashboard/padre` | GET | PARENT | 200 + layout con sidebar + placeholder "Inicio" |
| `/dashboard/padre/expedientes` | GET | PARENT | 200 + placeholder "Mis expedientes" |
| `/dashboard/padre/reportar` | GET | PARENT | 200 + placeholder "Reportar" |
| `/dashboard/padre/suscripcion` | GET | PARENT | 200 + placeholder "Suscripción" |
| `/dashboard/padre/circulo-confianza` | GET | PARENT | 200 + placeholder "Círculo confianza" |
| `/dashboard/padre/notificaciones` | GET | PARENT | 200 + placeholder "Notificaciones" |
| `/dashboard/padre/perfil` | GET | PARENT | 200 + placeholder "Mi perfil" |

## Componente `PadreSideNav`

**Props:** ninguna (usa `usePathname` y constantes internas).

**Items renderizados:**

| href | label |
|---|---|
| `/dashboard/padre` | Inicio |
| `/dashboard/padre/expedientes` | Mis expedientes |
| `/dashboard/padre/reportar` | Reportar |
| `/dashboard/padre/suscripcion` | Suscripción |
| `/dashboard/padre/circulo-confianza` | Círculo confianza |
| `/dashboard/padre/notificaciones` | Notificaciones |
| `/dashboard/padre/perfil` | Mi perfil |

**Comportamiento:**
- El item cuyo `href` coincide con `pathname` (o es prefijo, excepto la raíz) recibe `aria-current="page"`.
- Estado activo: fondo `cielo-600`, texto blanco, sombra `cielo-500/25`.
- Estado inactivo: texto `cielo-900/70`, hover `bg-cielo-100`.
- Oculto en mobile (`hidden sm:flex`).

## Layout `/dashboard/padre/layout.tsx`

- Server component.
- Verifica token y rol PARENT.
- Aplica clase `theme-padre` al contenedor.
- Renderiza `PadreSideNav` + `children`.
- Hereda guarda de vigencia del layout raíz `/dashboard`.

## Tema `.theme-padre` (globals.css)

- Mapea tokens semánticos a la familia `cielo`.
- Aplica `bg-page` con gradientes radiales `cielo`.
- Aplica `accent-gradient` de `cielo` a `cielo-600`.
