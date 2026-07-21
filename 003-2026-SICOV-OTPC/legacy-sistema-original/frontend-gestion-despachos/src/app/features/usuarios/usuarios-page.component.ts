import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { UsuariosService } from './usuarios.service';
import { UsuarioListado, UsuarioPayload, RolItem } from './usuarios.models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PaginatorComponent } from '../../shared/ui/paginator.component';
import { UsuarioFormComponent } from './usuario-form.component';
import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';
import { SubusuariosModalComponent } from './subusuarios-modal.component';
import Swal from 'sweetalert2';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-usuarios-page',
  standalone: true,
  imports: [ModalComponent, UsuarioFormComponent, SubusuariosModalComponent, PaginatorComponent],
  template: `
    <div class="container-fluid py-3 d-grid gap-3">
      <header class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
        <div>
          <h3 class="mb-1">Usuarios</h3>
          <p class="text-muted mb-0">Administración de usuarios y roles.</p>
        </div>
        <div class="d-flex gap-2">
          <button type="button" class="btn-brand btn-brand--sm" (click)="abrirCrear()" [hidden]="!canManageUsers()">Nuevo usuario</button>
        </div>
      </header>

      <section class="card border-1 shadow-sm">
        <div class="card-body d-grid gap-3">
          @if (errorMsg()) {
            <div class="alert alert-danger py-2 mb-0" role="alert">
              {{ errorMsg() }}
            </div>
          }
          <div class="row g-3 align-items-end">
            <div class="col-md-8">
              <label class="form-label text-muted mb-1">Buscar (identificación, nombre o correo)</label>
              <div class="input-group input-group-sm">
                <input type="search" class="form-control" [value]="filtroQuery()" (input)="onFiltroQuery($event)" placeholder="Ej: 800086050, Diego, usuario@dominio.com" />
                <button type="button" class="btn-outline-brand btn-brand--sm" (click)="limpiarFiltros()" [disabled]="!hayFiltros()">Limpiar</button>
              </div>
            </div>
            <div class="col-md-4">
              <label class="form-label text-muted mb-1">Filtrar por rol</label>
              <select class="form-select form-select-sm" [value]="filtroRol()" (change)="onFiltroRol($event)">
                <option value="">Todos</option>
                @for (r of roles(); track r.id) { <option [value]="r.id">{{ r.nombre }}</option> }
              </select>
            </div>
          </div>

          <div class="table-responsive border rounded">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Identificación</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @if (loading()) {
                  <tr><td colspan="6" class="text-center py-4"><div class="spinner-border" role="status" aria-label="Cargando"></div></td></tr>
                } @else if (!usuariosFiltradosPaginados().length) {
                  <tr><td colspan="6" class="text-center text-muted py-4">Sin usuarios para mostrar</td></tr>
                } @else {
                  @for (u of usuariosFiltradosPaginados(); track u.id) {
                    <tr>
                      <td class="fw-semibold">{{ u.identificacion }}</td>
                      <td>{{ u.nombre }}</td>
                      <td>{{ u.correo || '—' }}</td>
                      <td>{{ u.telefono || '—' }}</td>
                      <td>{{ u.rolNombre || '—' }}</td>
                      <td>
                        @if (u.estado) {
                          <span class="badge bg-success">Activo</span>
                        } @else {
                          <span class="badge bg-secondary">Inactivo</span>
                        }
                      </td>
                      <td class="text-end">
                        <!-- <button type="button" class="btn btn-sm btn-outline-primary" title="Operadores" aria-label="Gestionar operadores" (click)="abrirSubusuarios(u)" [hidden]="!(canManageSubusers() && (u.idRol === 2))">
                          <i class="bi bi-people"></i>
                        </button> -->
                        <button type="button" class="btn btn-sm btn-outline-secondary me-1" (click)="abrirEditar(u)" title="Editar" aria-label="Editar usuario" [hidden]="!canManageUsers()">
                          <i class="bi bi-pencil"></i>
                        </button>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          @if (!loading() && usuariosFiltrados().length > pageSize()) {
            <app-paginator
              [total]="usuariosFiltrados().length"
              [page]="page()"
              (pageChange)="page.set($event)"
              [pageSize]="pageSize()"
              (pageSizeChange)="onPageSize($event)"
              [storageKey]="'usuarios_list'"
            ></app-paginator>
          }
        </div>
      </section>

      <app-modal [open]="formAbierto()" [title]="formTitulo()" size="lg" (closed)="cerrarForm()">
        @if (formAbierto()) {
          <app-usuario-form [mode]="formModo()" [roles]="roles()" [initial]="formUsuario()" [saving]="formSaving()" (submit)="onFormSubmit($event)" (cancel)="cerrarForm()" />
        }
      </app-modal>

      <app-subusuarios-modal [open]="subModalAbierto()" [parent]="subParent()" (closed)="cerrarSubusuarios()" />
    </div>
  `,
  styles: [`:host{display:block;}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosPageComponent {
  private readonly service = inject(UsuariosService);
  private readonly storage = inject(ServicioLocalStorage);

  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly usuarios = signal<UsuarioListado[]>([]);
  protected readonly roles = signal<RolItem[]>([]);
  protected readonly filtroQuery = signal('');
  protected readonly filtroRol = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(PAGE_SIZE);

  protected readonly formAbierto = signal(false);
  protected readonly formModo = signal<'create' | 'edit'>('create');
  protected readonly formUsuario = signal<UsuarioListado | null>(null);
  protected readonly formSaving = signal(false);
  private readonly refreshing = signal(false);

  // Subusuarios modal state
  protected readonly subModalAbierto = signal(false);
  protected readonly subParent = signal<UsuarioListado | null>(null);

  // Role-based permissions
  protected readonly rolId = computed(() => Number(this.storage.obtenerRol()?.id ?? 0));
  protected readonly canManageUsers = computed(() => this.rolId() === 1);
  protected readonly canManageSubusers = computed(() => this.rolId() === 1 || this.rolId() === 2);

  protected readonly usuariosFiltrados = computed(() => {
    console.log(this.usuarios());
    const lista = this.usuarios();
    const rol = this.filtroRol().trim();
    const q = this.filtroQuery().toLowerCase().trim();
    return lista.filter(u => {
      if (rol && String(u.idRol) !== rol) return false;
      if (!q) return true;
      const identStr = String(u.identificacion ?? '');
      const nombre = u.nombre?.toLowerCase() ?? '';
      const correo = (u.correo ?? '').toLowerCase();
      return identStr.includes(q) || nombre.includes(q) || correo.includes(q);
    });
  });

  protected readonly usuariosFiltradosPaginados = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.usuariosFiltrados().slice(start, start + this.pageSize());
  });
  protected readonly totalPaginas = computed(() => {
    const total = this.usuariosFiltrados().length;
    return total ? Math.ceil(total / this.pageSize()) : 1;
  });
  protected readonly hayFiltros = computed(() => !!(this.filtroQuery() || this.filtroRol()));

  protected readonly formTitulo = computed(() => this.formModo() === 'edit' ? 'Editar usuario' : 'Nuevo usuario');

  constructor() {
    this.cargarDatos();
  }

  private cargarDatos() {
    if (this.refreshing()) return; // lock to avoid duplicated reloads
    this.refreshing.set(true);
    this.loading.set(true);
    this.errorMsg.set(null);
    // Cargar roles y usuarios juntos para unificar nombres de rol cuando falten
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({ users: this.service.listarUsuarios({ rol: true }), roles: this.service.obtenerRoles() }).subscribe({
        next: ({ users, roles }) => {
          const rolesRaw = roles ?? [];
          const rolesSinExcluido = rolesRaw.filter(r => Number(r.id) !== 3);
          this.roles.set(rolesSinExcluido);
          const idToName = new Map(rolesRaw.map(r => [String(r.id), r.nombre]));
          const nameToId = new Map(rolesRaw.map(r => [String(r.nombre).toLowerCase(), r.id]));
          console.log('Roles cargados:', rolesRaw, 'Usuarios cargados:', users);
          const unificados = (users ?? []).map(u => {
            // Si falta el idRol pero tenemos el nombre, lo inferimos
            const inferredIdRol = u.idRol ?? (u.rolNombre ? nameToId.get(String(u.rolNombre).toLowerCase()) : undefined);
            const resolvedNombre = u.rolNombre ?? (inferredIdRol != null ? idToName.get(String(inferredIdRol)) : undefined);
            return {
              ...u,
              idRol: inferredIdRol ?? u.idRol,
              rolNombre: resolvedNombre,
            };
          });
          const visibles = unificados.filter(u => { // Excluir subusuarios (rol 3)
            const uRol = u.idRol ?? (u.rolNombre ? nameToId.get(String(u.rolNombre).toLowerCase()) : undefined);
            return Number(uRol ?? 0) !== 3;
          });
          this.usuarios.set(visibles);
          this.loading.set(false);
          this.refreshing.set(false);
        },
        error: (err) => {
          console.error('Error cargando usuarios/roles', err);
          this.errorMsg.set('No fue posible cargar el listado de usuarios. Intenta nuevamente.');
          this.loading.set(false);
          this.refreshing.set(false);
        },
      });
    });
  }

  onFiltroQuery(e: Event) { this.filtroQuery.set((e.target as HTMLInputElement).value); this.page.set(1); }
  onFiltroRol(e: Event) { this.filtroRol.set((e.target as HTMLSelectElement).value); this.page.set(1); }
  limpiarFiltros() { this.filtroQuery.set(''); this.filtroRol.set(''); this.page.set(1); }
  paginaAnterior() { this.page.update(p => Math.max(1, p - 1)); }
  paginaSiguiente() { this.page.update(p => Math.min(this.totalPaginas(), p + 1)); }
  onPageSize(size: number) { this.pageSize.set(Math.max(1, Number(size)||PAGE_SIZE)); this.page.set(1); }

  abrirCrear() { this.formModo.set('create'); this.formUsuario.set(null); this.formAbierto.set(true); }
  abrirEditar(u: UsuarioListado) { this.formModo.set('edit'); this.formUsuario.set(u); this.formAbierto.set(true); }
  cerrarForm() { if (!this.formSaving()) { this.formAbierto.set(false); } }

  abrirSubusuarios(u: UsuarioListado) { this.subParent.set(u); this.subModalAbierto.set(true); }
  cerrarSubusuarios() { this.subModalAbierto.set(false); this.subParent.set(null); }

  onFormSubmit(evt: { payload: UsuarioPayload | Partial<UsuarioPayload>; modulos: number[] }) {
    if (this.formSaving()) return; // guard against double submit (click + Enter)
    if (this.formModo() === 'create') {
      this.formSaving.set(true);
      const payload = evt.payload as UsuarioPayload;
      Swal.fire({
        title: 'Creando usuario...',
        text: 'Por favor espera mientras se crea el usuario.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); },
      });
      this.service.crearUsuario(payload).subscribe({
        next: (resp) => {
          Swal.close();
          Swal.fire({
            icon: 'success',
            title: 'Usuario creado',
            text: 'El usuario ha sido creado exitosamente.',
            timer: 3000,
          });
          const done = () => { this.formSaving.set(false); this.formAbierto.set(false); this.cargarDatos(); };
          const mods = Array.isArray(evt.modulos) ? evt.modulos : [];
          if (!mods.length) { done(); return; }
          const createdId = this.service.extractUserId(resp);
          if (createdId != null) {
            this.service.asignarModulosUsuario(createdId, mods).subscribe({ next: done, error: done });
          } else {
            // Fallback: buscar por identificacion
            this.service.listarUsuarios({ termino: payload.identificacion }).subscribe({
              next: (users) => {
                const found = users.find(u => Number(u.identificacion) === Number(payload.identificacion))?.id;
                if (found != null) {
                  this.service.asignarModulosUsuario(found, mods).subscribe({ next: done, error: done });
                } else { done(); }
              },
              error: done,
            });
          }
        },
        error: (err) => {
          console.error('Error creando usuario', err);
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.message ?? 'No fue posible crear el usuario. Verifica los datos e intenta de nuevo.',
          });
          this.errorMsg.set('No fue posible crear el usuario. Verifica los datos e intenta de nuevo.');
          this.formSaving.set(false);
        },
      });
    } else {
      const ident = this.formUsuario()?.identificacion;
      if (!ident) return;
      this.formSaving.set(true);
      const payload = evt.payload as Partial<UsuarioPayload>;
      Swal.fire({
        title: 'Actualizando usuario...',
        text: 'Por favor espera mientras se actualiza el usuario.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); },
      });
      this.service.editarUsuario(ident, payload).subscribe({
        next: () => {
          Swal.close();
          Swal.fire({
            icon: 'success',
            title: 'Usuario actualizado',
            text: 'El usuario ha sido actualizado exitosamente.',
            timer: 3000,
          });
          const done = () => { this.formSaving.set(false); this.formAbierto.set(false); this.cargarDatos(); };
          const mods = Array.isArray(evt.modulos) ? evt.modulos : [];
          const userId = this.formUsuario()?.id;
          const rolId = Number((evt.payload as any)?.idRol ?? this.formUsuario()?.idRol ?? 0);
          if (userId != null && rolId === 2 && mods != null) {
            this.service.asignarModulosUsuario(userId, mods).subscribe({ next: done, error: done });
          } else {
            done();
          }
        },
        error: (err) => {
          console.error('Error editando usuario', err);
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.message ?? 'No fue posible actualizar el usuario. Intenta nuevamente.',
          });
          this.errorMsg.set('No fue posible actualizar el usuario. Intenta nuevamente.');
          this.formSaving.set(false);
        },
      });
    }
  }
}
