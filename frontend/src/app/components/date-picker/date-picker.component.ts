import { Component, ElementRef, HostListener, Input, OnDestroy, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

@Component({
  selector: 'app-date-picker',
  standalone: false,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePickerComponent), multi: true }
  ],
  template: `
    <div class="dp">
      <button type="button" class="dp-field" (click)="toggle()" [disabled]="disabled">
        <span [class.placeholder]="!selected">{{ displayValue || placeholder || '' }}</span>
        <span class="dp-icon">📅</span>
      </button>

      <div class="dp-panel" *ngIf="open" [style.top.px]="panelTop" [style.left.px]="panelLeft">
        <div class="dp-panel-head">
          <button type="button" class="dp-nav" (click)="prevMonth(); $event.stopPropagation()">‹</button>
          <div class="dp-title-selects">
            <select class="dp-select" [ngModel]="viewMonth" (ngModelChange)="viewMonth = $event" (click)="$event.stopPropagation()">
              <option *ngFor="let m of monthOptions" [ngValue]="m.value">{{ m.label }}</option>
            </select>
            <select class="dp-select" [ngModel]="viewYear" (ngModelChange)="viewYear = $event" (click)="$event.stopPropagation()">
              <option *ngFor="let y of yearOptions" [ngValue]="y.value">{{ y.label }}</option>
            </select>
          </div>
          <button type="button" class="dp-nav" (click)="nextMonth(); $event.stopPropagation()">›</button>
        </div>
        <div class="dp-dow-row">
          <span class="dp-dow mono" *ngFor="let d of dowLabels">{{ d }}</span>
        </div>
        <div class="dp-grid">
          <button type="button" *ngFor="let cell of cells"
                  class="dp-day"
                  [class.other-month]="!cell.inMonth"
                  [class.selected]="cell.isSelected"
                  [class.today]="cell.isToday"
                  (click)="pick(cell.date); $event.stopPropagation()">
            {{ cell.date.getDate() }}
          </button>
        </div>
        <div class="dp-footer">
          <button type="button" class="dp-today-btn" (click)="pick(today); $event.stopPropagation()">{{ i18n.t['today'] }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .dp { position: relative; display: inline-block; width: 100%; }
    .dp-field {
      width: 100%; height: 48px; padding: 0 12px; border-radius: var(--radius); border: 1px solid var(--line);
      background: var(--field); color: var(--ink); font-size: 14px; display: flex; align-items: center;
      justify-content: space-between; gap: 8px; font-family: 'Anuphan', sans-serif;
    }
    .dp-field:disabled { opacity: 0.6; cursor: not-allowed; }
    .dp-field .placeholder { color: var(--sub); }
    .dp-icon { font-size: 13px; flex: none; }

    .dp-panel {
      position: fixed; z-index: 30; width: 300px;
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      padding: 12px; box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26);
      animation: modalIn .16s ease both;
    }
    .dp-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .dp-nav {
      width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface);
      color: var(--sub); font-size: 15px;
    }
    .dp-nav:hover { border-color: var(--accent); color: var(--accent); }
    .dp-title-selects { display: flex; gap: 4px; flex: 1; min-width: 0; }
    .dp-select {
      flex: 1 1 0; min-width: 0; height: 30px; padding: 0 2px; border-radius: 8px; border: 1px solid var(--line);
      background: var(--surface); color: var(--ink); font-size: 11.5px; font-family: inherit; cursor: pointer;
    }
    .dp-select:focus { border-color: var(--accent); }

    .dp-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-top: 10px; }
    .dp-dow { text-align: center; font-size: 10.5px; color: var(--sub); padding: 4px 0; }

    .dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-top: 2px; }
    .dp-day {
      height: 32px; border-radius: 8px; border: none; background: transparent; color: var(--ink);
      font-size: 12.5px; font-family: 'IBM Plex Mono', monospace;
    }
    .dp-day:hover { background: var(--alt); }
    .dp-day.other-month { color: var(--sub); opacity: 0.5; }
    .dp-day.today { border: 1px solid var(--accent); }
    .dp-day.selected { background: var(--accent); color: #fff; font-weight: 700; }

    .dp-footer { display: flex; justify-content: flex-end; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line2); }
    .dp-today-btn { border: none; background: transparent; color: var(--accent); font-size: 12.5px; font-weight: 600; }
  `]
})
export class DatePickerComponent implements ControlValueAccessor, OnDestroy {
  @Input() placeholder = '';

  open = false;
  disabled = false;
  selected: Date | null = null;
  viewYear: number;
  viewMonth: number;
  today = new Date();
  panelTop = 0;
  panelLeft = 0;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  // Capture-phase so a scroll inside any ancestor (e.g. a scrollable modal list)
  // closes the panel too — scroll events don't bubble, only capture.
  private closeOnScroll = () => { if (this.open) this.open = false; };

  constructor(public i18n: I18nService, private elementRef: ElementRef) {
    this.viewYear = this.today.getFullYear();
    this.viewMonth = this.today.getMonth();
    document.addEventListener('scroll', this.closeOnScroll, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.closeOnScroll, true);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open && !this.elementRef.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }

  get locale(): string {
    return this.i18n.lang === 'th' ? 'th-TH' : 'en-US';
  }

  get displayValue(): string {
    if (!this.selected) return '';
    return this.selected.toLocaleDateString(this.locale, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  get monthLabel(): string {
    return new Date(this.viewYear, this.viewMonth, 1).toLocaleDateString(this.locale, { month: 'long', year: 'numeric' });
  }

  get monthOptions(): { value: number; label: string }[] {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: new Date(2023, i, 1).toLocaleDateString(this.locale, { month: 'long' })
    }));
  }

  get yearOptions(): { value: number; label: string }[] {
    const years: { value: number; label: string }[] = [];
    for (let y = this.viewYear - 10; y <= this.viewYear + 10; y++) {
      years.push({ value: y, label: this.i18n.lang === 'th' ? String(y + 543) : String(y) });
    }
    return years;
  }

  get dowLabels(): string[] {
    return Array.from({ length: 7 }, (_, i) => new Date(2023, 0, i + 1).toLocaleDateString(this.locale, { weekday: 'short' }));
  }

  get cells() {
    const firstDay = new Date(this.viewYear, this.viewMonth, 1);
    const lastDay = new Date(this.viewYear, this.viewMonth + 1, 0);
    const startOffset = firstDay.getDay();
    const cells: { date: Date; inMonth: boolean; isToday: boolean; isSelected: boolean }[] = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(this.viewYear, this.viewMonth, -i);
      cells.push(this.toCell(d, false));
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(this.viewYear, this.viewMonth, i);
      cells.push(this.toCell(d, true));
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push(this.toCell(d, false));
    }
    return cells;
  }

  private toCell(d: Date, inMonth: boolean) {
    return {
      date: d,
      inMonth,
      isToday: this.isSameDay(d, this.today),
      isSelected: !!this.selected && this.isSameDay(d, this.selected)
    };
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  toggle() {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      const base = this.selected || this.today;
      this.viewYear = base.getFullYear();
      this.viewMonth = base.getMonth();
      this.positionPanel();
    }
  }

  // The panel is position:fixed so it can escape any scrollable ancestor (a
  // long list in a modal, say) without being clipped — so its coordinates are
  // computed from the toggle button's own on-screen position, clamped to the
  // viewport instead of assumed to fit just below/left of the field.
  private positionPanel() {
    const fieldEl = this.elementRef.nativeElement.querySelector('.dp-field') as HTMLElement;
    const rect = fieldEl.getBoundingClientRect();
    const panelWidth = 300;
    const estimatedHeight = 340;
    const margin = 6;
    const edgeGap = 12;

    let left = rect.left;
    left = Math.min(left, window.innerWidth - panelWidth - edgeGap);
    left = Math.max(edgeGap, left);

    let top = rect.bottom + margin;
    if (top + estimatedHeight > window.innerHeight - edgeGap) {
      top = rect.top - estimatedHeight - margin;
    }
    top = Math.max(edgeGap, top);

    this.panelLeft = left;
    this.panelTop = top;
  }

  prevMonth() {
    const d = new Date(this.viewYear, this.viewMonth - 1, 1);
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth();
  }

  nextMonth() {
    const d = new Date(this.viewYear, this.viewMonth + 1, 1);
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth();
  }

  pick(date: Date) {
    this.selected = date;
    this.open = false;
    this.onTouched();
    this.onChange(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }

  writeValue(value: string): void {
    if (!value) {
      this.selected = null;
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    this.selected = new Date(y, m - 1, d);
    this.viewYear = this.selected.getFullYear();
    this.viewMonth = this.selected.getMonth();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
