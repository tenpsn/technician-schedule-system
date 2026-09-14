import { Component, ElementRef, HostListener, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

const STEP_MINUTES = 30;

@Component({
  selector: 'app-time-picker',
  standalone: false,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimePickerComponent), multi: true }
  ],
  template: `
    <div class="tp">
      <button type="button" class="tp-field" (click)="toggle()" [disabled]="disabled">
        <span [class.placeholder]="!value" class="mono">{{ value || placeholder || '--:--' }}</span>
        <span class="tp-icon">🕒</span>
      </button>

      <div class="tp-panel" *ngIf="open">
        <button type="button" *ngFor="let slot of slots"
                class="tp-slot mono"
                [class.selected]="slot === value"
                [attr.data-selected]="slot === value ? true : null"
                (click)="pick(slot); $event.stopPropagation()">
          {{ slot }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .tp { position: relative; display: block; width: 100%; }
    .tp-field {
      width: 100%; height: 48px; padding: 0 12px; border-radius: var(--radius); border: 1px solid var(--line);
      background: var(--field); color: var(--ink); font-size: 14px; display: flex; align-items: center;
      justify-content: space-between; gap: 8px; font-family: 'Anuphan', sans-serif;
    }
    .tp-field:disabled { opacity: 0.6; cursor: not-allowed; }
    .tp-field .placeholder { color: var(--sub); }
    .tp-icon { font-size: 13px; flex: none; }

    .tp-panel {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 30; max-height: 240px;
      overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      padding: 6px; box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26); scrollbar-gutter: stable;
      animation: modalIn .16s ease both;
    }
    .tp-slot {
      display: block; width: 100%; text-align: center; height: 34px; border-radius: 8px; border: none;
      background: transparent; color: var(--ink); font-size: 13px;
    }
    .tp-slot:hover { background: var(--alt); }
    .tp-slot.selected { background: var(--accent); color: #fff; font-weight: 700; }
  `]
})
export class TimePickerComponent implements ControlValueAccessor {
  @Input() placeholder = '';

  open = false;
  disabled = false;
  value: string | null = null;
  slots: string[] = this.buildSlots();

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open && !this.elementRef.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }

  private buildSlots(): string[] {
    const slots: string[] = [];
    for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
      slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
    }
    return slots;
  }

  toggle() {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      setTimeout(() => {
        const panel: HTMLElement | null = this.elementRef.nativeElement.querySelector('.tp-panel');
        const selected: HTMLElement | null = this.elementRef.nativeElement.querySelector('.tp-slot.selected');
        if (panel && selected) {
          panel.scrollTop = selected.offsetTop - panel.offsetHeight / 2 + selected.offsetHeight / 2;
        }
      });
    }
  }

  pick(slot: string) {
    this.value = slot;
    this.open = false;
    this.onTouched();
    this.onChange(slot);
  }

  writeValue(value: string): void {
    this.value = value || null;
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
