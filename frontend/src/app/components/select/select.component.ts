import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
  // ลิงก์รูปเล็กที่แสดงหน้าข้อความ เช่น รูปโปรไฟล์ช่าง ไม่ใส่ก็แสดงแค่ข้อความ
  image?: string | null;
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
        <span class="sel-label" [class.placeholder]="!selectedLabel">
          <img *ngIf="selectedImage" class="sel-img" [src]="selectedImage" alt="">
          {{ selectedLabel || placeholder }}
        </span>
        <span class="sel-arrow">▾</span>
      </button>

      <div class="sel-panel" *ngIf="open" [style.top.px]="panelTop" [style.bottom.px]="panelBottom" [style.left.px]="panelLeft" [style.min-width.px]="panelMinWidth">
        <button type="button" *ngFor="let opt of options"
                class="sel-opt"
                [class.selected]="isSelected(opt)"
                (click)="pick(opt); $event.stopPropagation()">
          <img *ngIf="opt.image" class="sel-img" [src]="opt.image" alt="">
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
      position: fixed; z-index: 30; width: max-content;
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
    .sel-img { width: 22px; height: 22px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 8px; }
    .sel-field.compact .sel-img { width: 18px; height: 18px; margin-right: 6px; }
    .sel-empty { padding: 10px; font-size: 12.5px; color: var(--sub); text-align: center; }
  `]
})
export class SelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = '';
  @Input() compact = false;

  open = false;
  disabled = false;
  value: any = null;
  panelTop: number | null = 0;
  panelBottom: number | null = null;
  panelLeft = 0;
  panelMinWidth = 0;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  // panel แบบ fixed ไม่เลื่อนตามหน้า ถ้าคำนวณตำแหน่งตามทุกครั้งจะช้ากว่าจอหนึ่งเฟรมจนเห็นกระตุก จึงปิดไปเลยเหมือน date picker
  // ข้ามการเลื่อนภายในรายการเอง และต้องสั่งวาดใหม่เอง เพราะแอปนี้ไม่ได้ใช้ zone ตรวจการเปลี่ยนแปลงให้
  private closeOnScroll = (event: Event) => {
    if (!this.open || this.elementRef.nativeElement.querySelector('.sel-panel')?.contains(event.target)) return;
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

  get selectedLabel(): string {
    const found = this.options.find(o => o.value === this.value);
    return found ? found.label : '';
  }

  get selectedImage(): string | null {
    return this.options.find(o => o.value === this.value)?.image || null;
  }

  isSelected(opt: SelectOption): boolean {
    return opt.value === this.value;
  }

  toggle() {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) this.positionPanel();
  }

  // panel เป็น position fixed หลุดออกจาก modal ที่เลื่อนได้ ไม่ถูกตัดหรือต้องเลื่อนลงไปหา เหมือน date picker
  // ถ้าด้านล่างที่ว่างไม่พอจะเปิดขึ้นด้านบนแทน
  private positionPanel() {
    const fieldEl = this.elementRef.nativeElement.querySelector('.sel-field') as HTMLElement;
    const rect = fieldEl.getBoundingClientRect();
    const edgeGap = 12;
    const margin = 6;
    const maxHeight = 260;
    const estimatedHeight = Math.min(maxHeight, Math.max(1, this.options.length) * 38 + 12);

    this.panelMinWidth = rect.width;
    this.panelLeft = Math.max(edgeGap, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 280) - edgeGap));

    const openUp = rect.bottom + margin + estimatedHeight > window.innerHeight - edgeGap
      && rect.top - estimatedHeight - margin >= edgeGap;
    // เปิดขึ้นบนให้ยึดขอบล่างของกล่องกับขอบบนของช่อง กล่องจะชิดช่องพอดีไม่ว่าจะสูงเท่าไร
    this.panelTop = openUp ? null : rect.bottom + margin;
    this.panelBottom = openUp ? window.innerHeight - rect.top + margin : null;
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
