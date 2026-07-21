import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'app-collapse-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="collapse-section border rounded overflow-hidden">
      <button
        type="button"
        class="collapse-section__header w-100 d-flex align-items-center justify-content-between gap-2"
        [attr.aria-expanded]="expanded()"
        (click)="toggle()"
      >
        <span class="d-flex align-items-center gap-2">
          <span class="fw-semibold">{{ title() }}</span>
          @if (badge()) {
            <span class="badge text-bg-success">{{ badge() }}</span>
          }
        </span>
        <span class="collapse-section__icon" aria-hidden="true">{{ expanded() ? '−' : '+' }}</span>
      </button>
      @if (expanded()) {
        <div class="collapse-section__body p-3 border-top">
          <ng-content />
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .collapse-section__header {
        border: 0;
        background:rgb(210, 230, 250);
        color: var(--brand-700);
        padding: 0.75rem 1rem;
        text-align: left;
      }
      .collapse-section__header:hover {
        background:rgb(200, 225, 250);
        color: var(--brand-700);
        cursor: pointer;
        box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
        transition: background 0.2s ease, color 0.2s ease;
      }
      .collapse-section__icon {
        font-size: 1.25rem;
        font-weight: 600;
        line-height: 1;
        min-width: 1.25rem;
        text-align: center;
      }
      .collapse-section__body { background: #fff; }
    `,
  ],
})
export class CollapseSectionComponent {
  title = input.required<string>();
  badge = input<string | null>(null);
  expanded = model(false);

  toggle(): void {
    this.expanded.set(!this.expanded());
  }
}
