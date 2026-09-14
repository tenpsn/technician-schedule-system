import { Component, ElementRef, HostListener, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: false,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }
  ],
  template: `
    <div class="sel">
      <button type="button" class="sel-field" [class.compact]="compact" (click)="toggle()" [disabled]="disabled">
        <span [class.placeholder]="!selectedLabel">{{ selectedLabel || placeholder }}</span>
        <span class="sel-arrow">▾</span>
      </button>

      <div class="sel-panel" *ngIf="open">
        <button type="button" *ngFor="let opt of options"
                class="sel-opt"
                [class.selected]="isSelected(opt)"
                (click)="pick(opt); $event.stopPropagation()">
          {{ opt.label }}
        </button>
        <div *ngIf="options.length === 0" class="sel-empty">–</div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .sel { position: relative; width: 100%; }
    .sel-field {
      width: 100%; height: 46px; padding: 0 12px; border-radius: var(--radius); border: 1px solid var(--line);
      background: var(--field); color: var(--ink); font-size: 14px; display: flex; align-items: center;
      justify-content: space-between; gap: 8px; font-family: inherit; text-align: left; cursor: pointer;
    }
    .sel-field span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sel-field.compact { height: 36px; padding: 0 8px; border-radius: 8px; font-size: 12.5px; }
    .sel-field:disabled { opacity: 0.6; cursor: not-allowed; }
    .sel-field .placeholder { color: var(--sub); }
    .sel-arrow { font-size: 10px; flex: none; color: var(--sub); }

    .sel-panel {
      position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; min-width: 100%; width: max-content;
      max-width: 280px; max-height: 260px; overflow-y: auto; background: var(--surface); border: 1px solid var(--line);
      border-radius: 14px; padding: 6px; box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26);
      animation: modalIn .16s ease both;
    }
    .sel-opt {
      display: block; width: 100%; text-align: left; padding: 9px 10px; border-radius: 8px; border: none;
      background: transparent; color: var(--ink); font-size: 13.5px; white-space: nowrap; cursor: pointer;
    }
    .sel-opt:hover { background: var(--alt); }
    .sel-opt.selected { background: var(--accent); color: #fff; font-weight: 600; }
    .sel-empty { padding: 10px; font-size: 12.5px; color: var(--sub); text-align: center; }
  `]
})
export class SelectComponent implements ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = '';
  @Input() compact = false;

  open = false;
  disabled = false;
  value: any = null;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open && !this.elementRef.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }

  get selectedLabel(): string {
    const found = this.options.find(o => o.value === this.value);
    return found ? found.label : '';
  }

  isSelected(opt: SelectOption): boolean {
    return opt.value === this.value;
  }

  toggle() {
    if (this.disabled) return;
    this.open = !this.open;
  }

  pick(opt: SelectOption) {
    this.value = opt.value;
    this.open = false;
    this.onTouched();
    this.onChange(opt.value);
  }

  writeValue(value: any): void {
    this.value = value ?? null;
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
