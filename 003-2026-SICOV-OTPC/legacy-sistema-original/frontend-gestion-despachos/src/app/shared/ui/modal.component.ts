import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(click)': 'backdropClick()'
  },
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1050; opacity: 1; }
    .dialog { background: #fff; border-radius: .5rem; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 .5rem 1rem rgba(0,0,0,.15); opacity: 1; }
    .dialog.sm { max-width: 420px; }
    .dialog.md { max-width: 640px; }
    .dialog.lg { max-width: 840px; }
    .dialog.xl { max-width: 1140px; }
    .dialog.xxl { max-width: min(95vw, 1920px); }
    .header { padding: .75rem 1rem; border-bottom: 1px solid rgba(0,0,0,.1); display: flex; align-items: center; justify-content: space-between; }
    .title { margin: 0; font-size: 1.1rem; }
    .body { padding: 1rem; overflow: auto; background: #eaf1faff; flex-grow: 1; }
    .close-btn { line-height: 1; border: none; background: transparent; font-size: 1.25rem; }

    /* Animations */
    @keyframes overlayIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes overlayOut { from { opacity: 1 } to { opacity: 0 } }
    @keyframes dialogIn { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
    @keyframes dialogOut { from { opacity: 1; transform: translateY(0) scale(1) } to { opacity: 0; transform: translateY(4px) scale(.985) } }

    .overlay.enter { animation: overlayIn .18s ease-out forwards }
    .overlay.leave { animation: overlayOut .16s ease-in forwards }
    .dialog.enter { animation: dialogIn .22s cubic-bezier(.2,0,0,1) forwards }
    .dialog.leave { animation: dialogOut .16s ease-in forwards }
  `],
  template: `
    @if (visible()) {
      <div class="overlay" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId" [class.enter]="animState()==='enter'" [class.leave]="animState()==='leave'" (animationend)="onAnimationEnd($event)">
        <div class="dialog" [class.sm]="size() === 'sm'" [class.md]="size() === 'md'" [class.lg]="size() === 'lg'" [class.xl]="size() === 'xl'" [class.xxl]="size() === 'xxl'" [class.enter]="animState()==='enter'" [class.leave]="animState()==='leave'" (click)="$event.stopPropagation()">
          <div class="header">
            <h6 class="title" [id]="titleId">{{ title() }}
              @if (requiredAllData()) {
                <span class="text-danger small"> - Todos los campos son requeridos</span>
              } @else if (optionalData()) {
                <span class="text-warning small"> - Los campos opcionales están marcados</span>
              }
            </h6>
            <button class="close-btn" type="button" aria-label="Cerrar" (click)="onClose()">×</button>
          </div>
          <div class="body">
            <ng-content></ng-content>
          </div>
        </div>
      </div>
    }
  `
})
export class ModalComponent {
  requiredAllData = input<boolean>(false);
  optionalData = input<boolean>(false);
  open = input<boolean>(false);
  title = input<string>('');
  size = input<'sm'|'md'|'lg'|'xl'|'xxl'>('md');
  closeOnBackdrop = input<boolean>(true);
  closed = output<void>();

  titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;

  // Animation state
  visible = signal(false);
  animState = signal<'idle'|'enter'|'leave'>('idle');

  // React to external open() changes
  _sync = effect(() => {
    if (this.open()) {
      if (!this.visible()) {
        this.visible.set(true);
      }
      this.animState.set('enter');
    } else if (this.visible()) {
      this.animState.set('leave');
    }
  });

  backdropClick() {
    if (this.open() && this.closeOnBackdrop()) this.onClose();
  }

  onClose() {
    this.closed.emit();
  }

  onAnimationEnd(_e: AnimationEvent) {
    if (this.animState() === 'leave') {
      this.visible.set(false);
      this.animState.set('idle');
    }
  }
}
