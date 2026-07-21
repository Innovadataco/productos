import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators, FormControl, ValidationErrors, AbstractControl } from '@angular/forms';
import { AutenticacionService } from '../../core/autenticacion.service';
import { ModalComponent } from '../../shared/ui/modal.component';

@Component({
  selector: 'app-change-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  template: `
  <app-modal [open]="open()" title="Cambio de contraseña" size="sm" (closed)="onClose()">
      <form class="d-grid gap-3" [formGroup]="form" (ngSubmit)="submit()">
        <!-- Clave actual -->
        <div>
          <label class="form-label" for="old">Clave actual</label>
          <div class="position-relative">
            <input [type]="showOld() ? 'text' : 'password'" id="old" class="form-control pe-5" formControlName="clave" autocomplete="current-password" required />
            <button type="button" class="btn btn-link position-absolute top-50 end-0 translate-middle-y me-1 px-2" (click)="toggleOld()" aria-label="Mostrar/ocultar clave actual">
              <i class="bi" [class.bi-eye]="!showOld()" [class.bi-eye-slash]="showOld()"></i>
            </button>
          </div>
          @if (invalid(clave)) { <small class="text-danger">Requerida.</small> }
        </div>

        <!-- Nueva clave + requisitos -->
        <div>
          <label class="form-label" for="new1">Nueva clave</label>
          <div class="position-relative">
            <input [type]="showNew() ? 'text' : 'password'" id="new1" class="form-control pe-5" formControlName="nuevaClave" autocomplete="new-password" required />
            <button type="button" class="btn btn-link position-absolute top-50 end-0 translate-middle-y me-1 px-2" (click)="toggleNew()" aria-label="Mostrar/ocultar nueva clave">
              <i class="bi" [class.bi-eye]="!showNew()" [class.bi-eye-slash]="showNew()"></i>
            </button>
          </div>
          <!-- Checklist de requisitos -->
          <div class="row row-cols-1 row-cols-sm-2 g-2 mt-2 small text-muted">
            <div class="col d-flex align-items-center gap-2" [class.text-success]="hasMinLength()">
              <i class="bi" [class.bi-check2-circle]="hasMinLength()" [class.bi-circle]="!hasMinLength()"></i>
              <span>8 caracteres</span>
            </div>
            <div class="col d-flex align-items-center gap-2" [class.text-success]="hasLower()">
              <i class="bi" [class.bi-check2-circle]="hasLower()" [class.bi-circle]="!hasLower()"></i>
              <span>1 minúscula</span>
            </div>
            <div class="col d-flex align-items-center gap-2" [class.text-success]="hasUpper()">
              <i class="bi" [class.bi-check2-circle]="hasUpper()" [class.bi-circle]="!hasUpper()"></i>
              <span>1 mayúscula</span>
            </div>
            <div class="col d-flex align-items-center gap-2" [class.text-success]="hasDigit()">
              <i class="bi" [class.bi-check2-circle]="hasDigit()" [class.bi-circle]="!hasDigit()"></i>
              <span>1 número</span>
            </div>
            <div class="col d-flex align-items-center gap-2" [class.text-success]="hasSpecial()">
              <i class="bi" [class.bi-check2-circle]="hasSpecial()" [class.bi-circle]="!hasSpecial()"></i>
              <span>1 carácter especial</span>
            </div>
          </div>
          @if (invalid(nuevaClave)) { <small class="text-danger d-block mt-1">Debe tener mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.</small> }
        </div>

        <!-- Confirmar nueva clave -->
        <div>
          <label class="form-label" for="new2">Confirmar nueva clave</label>
          <div class="position-relative">
            <input [type]="showConfirm() ? 'text' : 'password'" id="new2" class="form-control pe-5" formControlName="confirmar" autocomplete="new-password" required />
            <button type="button" class="btn btn-link position-absolute top-50 end-0 translate-middle-y me-1 px-2" (click)="toggleConfirm()" aria-label="Mostrar/ocultar confirmación">
              <i class="bi" [class.bi-eye]="!showConfirm()" [class.bi-eye-slash]="showConfirm()"></i>
            </button>
          </div>
          @if (form.hasError('noMatch') && (confirmar.touched || confirmar.dirty)) { <small class="text-danger">Las claves no coinciden.</small> }
        </div>

        @if (errorMsg()) { <div class="alert alert-danger py-2">{{ errorMsg() }}</div> }
        @if (successMsg()) { <div class="alert alert-success py-2">{{ successMsg() }}</div> }

        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-outline-secondary" (click)="onClose()" [disabled]="loading()">Cancelar</button>
          <button type="submit" class="btn-brand" [disabled]="loading() || form.invalid">{{ loading() ? 'Guardando…' : 'Cambiar' }}</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class ChangePasswordComponent {
  private readonly fb = new FormBuilder();
  private readonly auth = inject(AutenticacionService);

  open = input<boolean>(false);
  closed = output<void>();

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  // Password policy: min 8, at least one upper, lower, digit, special
  private static passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

  form = this.fb.nonNullable.group({
    clave: ['', Validators.required],
    nuevaClave: ['', [Validators.required, Validators.pattern(ChangePasswordComponent.passwordPolicy)]],
    confirmar: ['', Validators.required],
  }, { validators: [this.matchValidator] });

  readonly clave = this.form.controls.clave as FormControl<string>;
  readonly nuevaClave = this.form.controls.nuevaClave as FormControl<string>;
  readonly confirmar = this.form.controls.confirmar as FormControl<string>;

  invalid(ctrl: FormControl<unknown>) { return ctrl.invalid && ctrl.touched; }

  // Mostrar/ocultar
  showOld = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);
  toggleOld() { this.showOld.update(v => !v); }
  toggleNew() { this.showNew.update(v => !v); }
  toggleConfirm() { this.showConfirm.update(v => !v); }

  // Requisitos dinámicos para nueva clave (reactivo con valueChanges)
  private readonly pwd = toSignal(this.nuevaClave.valueChanges, { initialValue: this.nuevaClave.value ?? '' });
  hasMinLength = computed(() => (this.pwd() || '').length >= 8);
  hasLower = computed(() => /[a-z]/.test(this.pwd() || ''));
  hasUpper = computed(() => /[A-Z]/.test(this.pwd() || ''));
  hasDigit = computed(() => /\d/.test(this.pwd() || ''));
  hasSpecial = computed(() => /[^\w\s]/.test(this.pwd() || ''));

  private matchValidator(group: AbstractControl): ValidationErrors | null {
    const n1 = group.get('nuevaClave')?.value;
    const n2 = group.get('confirmar')?.value;
    return n1 && n2 && n1 !== n2 ? { noMatch: true } : null;
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const u = this.auth.getUsuario();
    const identificacion = u?.usuario || '';
    if (!identificacion) {
      this.errorMsg.set('No se encontró la identificación del usuario.');
      return;
    }
    const { clave, nuevaClave } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.auth.cambiarClave(identificacion, clave, nuevaClave).subscribe({
      next: () => { this.loading.set(false); this.successMsg.set('Contraseña actualizada.'); this.form.reset(); },
      error: (err) => { console.error(err); this.loading.set(false); this.errorMsg.set('No fue posible cambiar la contraseña. Verifica la clave actual.'); },
    });
  }

  onClose() { this.closed.emit(); }

  // Limpia el formulario y estado cada vez que se abre el modal
  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.errorMsg.set(null);
        this.successMsg.set(null);
        this.loading.set(false);
        this.showOld.set(false);
        this.showNew.set(false);
        this.showConfirm.set(false);
      }
    });
  }
}
