import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ServicioLocalStorage } from '../../administrador/servicios/local-storage.service';
import { Usuario, Rol } from '../../core/models/auth.models';

@Component({
  selector: 'app-page-header',
  template: `
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
      <div>
        <h3 class="mb-1">{{ title() }}</h3>
        @if (subtitle()) { <p class="text-muted mb-0">{{ subtitle() }}</p> }
      </div>
      @if (showUser() && displayedUsuario()) {
        <div class="text-md-end">
          <div class="fw-semibold">{{ displayedUsuario()?.nombre || 'Usuario' }}</div>
          <div class="text-muted small">
            @if (rol() && rol()!.id === 2) {
              Nit
            }
            @else { ID }
            {{ displayedUsuario()?.usuario || '—' }}
          </div>
        </div>
      } @else if (showUser()) {
        <div class="text-md-end text-muted small">Usuario no disponible</div>
      }
      <ng-content select="[header-actions]"></ng-content>
    </div>
  `,
  styles: [`:host{display:block;}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  private readonly storage = inject(ServicioLocalStorage);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // Inputs
  title = input<string>('');
  subtitle = input<string>('');
  showUser = input<boolean>(true);
  usuarioInput = input<Usuario | null | undefined>(undefined);
  rolInput = input<Rol | null | undefined>(undefined);

  // Internal signals when inputs not provided
  private readonly usuario = signal<Usuario | null>(null);
  readonly rol = signal<Rol | null>(null);

  protected readonly displayedUsuario = computed(() => {
    const external = this.usuarioInput();
    return external !== undefined ? (external ?? null) : this.usuario();
  });

  constructor() {
    // Only fetch if no external value provided initially
    if (this.usuarioInput() === undefined) {
      this.rol.set(this.storage.obtenerRol());
      this.usuario.set(this.storage.obtenerUsuario());

      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const rawUsuario = params.get('usuario');
        if (!rawUsuario) return;
        try {
          const parsed = JSON.parse(rawUsuario) as Usuario;
          this.usuario.set(parsed);
        } catch {
          console.warn('No se pudo interpretar el usuario recibido en la ruta.');
        }
      });
    }

    // If later an external usuario is fed (dynamic), sync effect
    effect(() => {
      if (this.usuarioInput() !== undefined) {
        // external management, do nothing extra
      }
    });
  }
}
