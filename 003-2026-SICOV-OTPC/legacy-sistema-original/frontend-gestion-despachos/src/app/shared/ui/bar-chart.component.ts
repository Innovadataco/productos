import { ChangeDetectionStrategy, Component, input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface BarSegment {
  key: string; // category name
  value: number; // quantity for the category
}
export interface BarDatum {
  label: string; // date string, e.g. "dd/MM/yyyy"
  segments: BarSegment[]; // stacked segments per date
}

@Component({
  selector: 'app-bar-chart',
  imports: [CommonModule],
  template: `
    <div class="legend" *ngIf="showLegend()">
      @for (key of categories(); track key) {
        <span class="legend-item">
          <span class="legend-swatch" [style.background-color]="segmentColor(key)"></span>
          <span>{{ key }}</span>
        </span>
      }
    </div>

    <div class="chart-container" role="img" aria-label="Barras horizontales por fecha">
      <svg class="chart-svg" [attr.viewBox]="'0 0 ' + width + ' ' + computedSvgHeight" preserveAspectRatio="xMinYMin meet">
        <g [attr.transform]="'translate(' + marginLeft + ',' + marginTop + ')'"><!-- Background bands and separators per date row -->
          <g class="row-bands">
            @for (d of data(); let i = $index; track i) {
              <rect class="row-band"
                [attr.x]="0"
                [attr.y]="rowYOffsets()[i]"
                [attr.width]="innerWidth"
                [attr.height]="rowBandHeight(d.segments.length)"
                [attr.fill]="i % 2 === 0 ? '#f3f4f6' : '#ffffff'"
              />
              <line class="row-sep"
                [attr.x1]="0"
                [attr.x2]="innerWidth"
                [attr.y1]="rowYOffsets()[i] + rowBandHeight(d.segments.length)"
                [attr.y2]="rowYOffsets()[i] + rowBandHeight(d.segments.length)"
              />
            }
          </g>

          <!-- X grid lines should render over bands but under bars -->
          <g class="x-grid">
            @for (x of xTicks; track x) {
              <line [attr.x1]="x" [attr.x2]="x" [attr.y1]="0" [attr.y2]="innerHeight" />
            }
          </g>

          <g class="bars">
            @for (d of data(); let i = $index; track i) {
              <g (mouseenter)="onEnter(i)" (mouseleave)="onLeave()">
                @for (seg of d.segments; let j = $index; track j) {
                  <rect
                    [attr.x]="0"
                    [attr.y]="rowYOffsets()[i] + j * (segmentBarHeight + segmentGap)"
                    [attr.width]="(seg.value / maxStackValue() * innerWidth)"
                    [attr.height]="segmentBarHeight"
                    class="bar"
                    [attr.fill]="segmentColor(seg.key, j)"
                  >
                    <title>{{ formatLabel(d.label) }} - {{ seg.key }}: {{ seg.value }}</title>
                  </rect>
                  <text
                    class="bar-value"
                    [attr.x]="segmentLabelX(seg.value)"
                    [attr.y]="rowYOffsets()[i] + j * (segmentBarHeight + segmentGap) + segmentBarHeight / 2"
                    dominant-baseline="middle"
                    [attr.text-anchor]="segmentLabelAnchor(seg.value)"
                  >{{ seg.value > 0 ? seg.value : '' }}</text>
                }
                <text
                  class="y-tick-label"
                  [attr.x]="-8"
                  [attr.y]="rowYOffsets()[i] + rowBandHeight(d.segments.length) / 2 + 4"
                  text-anchor="end"
                >{{ formatLabel(d.label) }}</text>
              </g>
            }
          </g>

          @if (hoveredIndex() !== null) {
            <g class="tooltip" [attr.transform]="'translate(' + tooltipX() + ',' + tooltipY() + ')'">
              <rect rx="4" ry="4" [attr.width]="tooltipWidth" [attr.height]="tooltipHeight" class="tooltip-bg"></rect>
              <text x="8" y="16" class="tooltip-text">{{ tooltipLabel() }}</text>
            </g>
          }
        </g>
      </svg>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .chart-container { width: 100%; overflow-x: auto; overflow-y: auto; max-height: 320px; }
    .chart-svg { width: 100%; height: auto; }
    svg { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; }
    .bar:hover { opacity: 0.9; }
    .bar-value { font-size: 12px; fill: #212529; stroke: #fff; stroke-width: 3; paint-order: stroke; font-weight: 600; }
    .x-grid line { stroke: #e9ecef; stroke-width: 1; }
    .legend { position: sticky; top: 0; background: #fff; display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 0; z-index: 2; border-bottom: 1px solid #e9ecef; }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #495057; }
    .legend-swatch { width: 12px; height: 12px; border-radius: 2px; border: 1px solid #dee2e6; }
    .tooltip-bg { fill: #000; opacity: 0.85; }
    .tooltip-text { fill: #fff; font-size: 12px; }
    .y-tick-label { font-size: 12px; fill: #6c757d; }
    .row-band { stroke: #dee2e6; stroke-width: 1; }
    .row-sep { stroke: #ced4da; stroke-width: 2; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChartComponent {
  data = input.required<BarDatum[]>();
  colors = input<string[] | undefined>();
  showLegend = input<boolean>(true);

  width = 760;
  height = 300;
  marginTop = 10;
  marginLeft = 80; // room for Y labels
  marginRight = 20;
  marginBottom = 20;

  barGap = 12; // gap between date rows
  segmentGap = 4; // gap between category bars within a date row
  segmentBarHeight = 10; // thin bars

  get innerWidth() { return this.width - this.marginLeft - this.marginRight; }
  get innerHeightBase() { return this.height - this.marginTop - this.marginBottom; }
  // Adjust innerHeight dynamically to fit grouped bars per row
  get innerHeight() {
    const arr = this.data() ?? [];
    if (arr.length === 0) return this.innerHeightBase;
    const totalBands = arr.reduce((sum, d) => sum + this.rowBandHeight(d.segments.length), 0);
    const totalGaps = Math.max(0, arr.length - 1) * this.barGap;
    const desired = totalBands + totalGaps;
    return Math.max(this.innerHeightBase, desired);
  }
  get computedSvgHeight() { return this.marginTop + this.innerHeight + this.marginBottom; }

  // maximum total per date for scaling stacked bars
  maxStackValue = computed(() => {
    const arr = this.data();
    if (!arr || arr.length === 0) return 1;
    const totals = arr.map(d => this.rowTotal(d.segments));
    return Math.max(...totals, 1);
  });

  // Height of a date row band based on number of category segments
  rowBandHeight(segmentCount: number): number {
    if (segmentCount <= 0) return this.segmentBarHeight;
    return segmentCount * (this.segmentBarHeight + this.segmentGap) - this.segmentGap;
  }

  // Cumulative Y offset for each date row
  rowYOffsets(): number[] {
    const arr = this.data() ?? [];
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < arr.length; i++) {
      offsets.push(acc);
      acc += this.rowBandHeight(arr[i].segments.length) + this.barGap;
    }
    return offsets;
  }

  get xTicks(): number[] {
    const steps = 4;
    const ticks: number[] = [];
    for (let i = 1; i <= steps; i++) {
      const x = (i / steps) * this.innerWidth;
      ticks.push(x);
    }
    return ticks;
  }
  segmentColor(key: string, j?: number): string {
    const palette = this.colors() ?? [
      '#0d6efd', '#6f42c1', '#198754', '#fd7e14', '#dc3545',
      '#20c997', '#6610f2', '#0dcaf0', '#ffc107', '#343a40'
    ];
    const idx = j ?? this.categories().indexOf(key);
    return palette[Math.max(0, idx) % palette.length];
  }

  // Tooltip state
  hoveredIndex = signal<number | null>(null);
  tooltipWidth = 180;
  tooltipHeight = 24;

  onEnter(i: number) { this.hoveredIndex.set(i); }
  onLeave() { this.hoveredIndex.set(null); }

  tooltipX = computed(() => {
    const i = this.hoveredIndex();
    if (i === null) return 0;
    const d = this.data()[i];
    const x = (this.rowTotal(d.segments) / this.maxStackValue() * this.innerWidth) - this.tooltipWidth - 8;
    return Math.max(0, Math.min(this.innerWidth - this.tooltipWidth, x));
  });

  tooltipY = computed(() => {
    const i = this.hoveredIndex();
    if (i === null) return 0;
    const y = this.rowYOffsets()[i] + this.rowBandHeight(this.data()[i]?.segments.length ?? 0) / 2 - this.tooltipHeight / 2;
    return Math.max(0, Math.min(this.innerHeight - this.tooltipHeight, y));
  });

  tooltipLabel = computed(() => {
    const i = this.hoveredIndex();
    if (i === null) return '';
    const d = this.data()[i];
    return `${this.formatLabel(d.label)}: ${this.rowTotal(d.segments)}`;
  });

  formatLabel(label: string): string {
    // Expect labels like "dd/MM/yyyy"; keep as-is but could trim
    return label;
  }

  rowTotal(segments: BarSegment[]): number {
    return segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  }

  stackedX(segments: BarSegment[], idx: number): number {
    const prev = segments.slice(0, idx).reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    return (prev / this.maxStackValue() * this.innerWidth);
  }

  categories = computed(() => {
    const arr = this.data();
    if (!arr || arr.length === 0) return [] as string[];
    const set = new Set<string>();
    for (const d of arr) for (const s of d.segments) set.add(s.key);
    return Array.from(set);
  });

  segmentWidth(value: number): number {
    return (Number(value) || 0) / this.maxStackValue() * this.innerWidth;
  }
  segmentLabelAnchor(value: number): 'end' | 'start' {
    return this.segmentWidth(value) < 24 ? 'start' : 'end';
  }
  segmentLabelX(value: number): number {
    const w = this.segmentWidth(value);
    return this.segmentLabelAnchor(value) === 'end' ? w - 4 : w + 6;
  }
}
