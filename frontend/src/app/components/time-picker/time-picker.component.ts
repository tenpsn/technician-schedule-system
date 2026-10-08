import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, forwardRef } from '@angular/core';
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

      <div class="tp-panel" *ngIf="open" [style.top.px]="panelTop" [style.bottom.px]="panelBottom" [style.left.px]="panelLeft" [style.width.px]="panelWidth">
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
      position: fixed; z-index: 30; max-height: 240px;
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
export class TimePickerComponent implements ControlValueAccessor, OnDestroy {
  @Input() placeholder = '';

  open = false;
  disabled = false;
  value: string | null = null;
  slots: string[] = this.buildSlots();
  panelTop: number | null = 0;
  panelBottom: number | null = null;
  panelLeft = 0;
  panelWidth = 0;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // panel แบบ fixed ไม่เลื่อนตามหน้า ถ้าคำนวณตำแหน่งตามทุกครั้งจะช้ากว่าจอหนึ่งเฟรมจนเห็นกระตุก จึงปิดไปเลยเหมือน date picker
  // ข้ามการเลื่อนภายในรายการเอง และต้องสั่งวาดใหม่เอง เพราะแอปนี้ไม่ได้ใช้ zone ตรวจการเปลี่ยนแปลงให้
  private closeOnScroll = (event: Event) => {
    if (!this.open || this.elementRef.nativeElement.querySelector('.tp-panel')?.contains(event.target)) return;
    this.open = false;
    this.cdr.detectChanges();
  };

  constructor(private elementRef: ElementRef, private cdr: ChangeDetectorRef) {
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
      this.positionPanel();
      setTimeout(() => {
        const panel: HTMLElement | null = this.elementRef.nativeElement.querySelector('.tp-panel');
        const selected: HTMLElement | null = this.elementRef.nativeElement.querySelector('.tp-slot.selected');
        if (panel && selected) {
          panel.scrollTop = selected.offsetTop - panel.offsetHeight / 2 + selected.offsetHeight / 2;
        }
      });
    }
  }

  // panel เป็น position fixed หลุดออกจากส่วนที่ถูกตัดหรือโดนแถบปุ่มด้านล่างบัง เหมือน date picker
  // ถ้าด้านล่างที่ว่างไม่พอจะเปิดขึ้นด้านบนแทน
  private positionPanel() {
    const fieldEl = this.elementRef.nativeElement.querySelector('.tp-field') as HTMLElement;
    const rect = fieldEl.getBoundingClientRect();
    const edgeGap = 12;
    const margin = 6;
    const panelHeight = 240;

    this.panelWidth = rect.width;
    this.panelLeft = rect.left;
    const openUp = rect.bottom + margin + panelHeight > window.innerHeight - edgeGap
      && rect.top - panelHeight - margin >= edgeGap;
    // เปิดขึ้นบนให้ยึดขอบล่างของกล่องกับขอบบนของช่อง กล่องจะชิดช่องพอดีไม่ว่าจะสูงเท่าไร
    this.panelTop = openUp ? null : rect.bottom + margin;
    this.panelBottom = openUp ? window.innerHeight - rect.top + margin : null;
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
