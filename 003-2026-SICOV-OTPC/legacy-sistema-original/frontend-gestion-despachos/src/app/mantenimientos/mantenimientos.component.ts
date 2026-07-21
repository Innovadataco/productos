import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PreventivosComponent } from '../features/mantenimientos/preventivos/preventivos.component';
import { CorrectivosComponent } from '../features/mantenimientos/correctivos/correctivos.component';

@Component({
  selector: 'app-mantenimientos-tabs',
  standalone: true,
  imports: [CommonModule, PreventivosComponent, CorrectivosComponent],
  template: `
    <div class="card shadow-sm">
      <div class="card-header bg-white border-1 pb-0">
        <ul class="nav nav-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tab-preventivos" data-bs-toggle="tab" data-bs-target="#pane-preventivos" type="button" role="tab" aria-controls="pane-preventivos" aria-selected="true">
              <i class="bi bi-tools me-1"></i> Preventivos
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="tab-correctivos" data-bs-toggle="tab" data-bs-target="#pane-correctivos" type="button" role="tab" aria-controls="pane-correctivos" aria-selected="false">
              <i class="bi bi-wrench-adjustable me-1"></i> Correctivos
            </button>
          </li>
        </ul>
      </div>
      <div class="card-body tab-content">
        <div id="pane-preventivos" class="tab-pane fade show active" role="tabpanel" aria-labelledby="tab-preventivos">
          <app-preventivos-view></app-preventivos-view>
        </div>
        <div id="pane-correctivos" class="tab-pane fade" role="tabpanel" aria-labelledby="tab-correctivos">
          <app-correctivos-view></app-correctivos-view>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MantenimientosTabsComponent {}
