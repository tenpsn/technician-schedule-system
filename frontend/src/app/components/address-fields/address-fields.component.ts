import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { I18nService } from '../../services/i18n.service';
import { AddressTree, ProvinceService } from '../../services/province.service';
import { SelectOption } from '../select/select.component';
import { getProvinceLabel } from '../../constants/provinces';

const BANGKOK = 'กรุงเทพมหานคร';

// ช่องที่อยู่แบบเลือกต่อกัน จังหวัด แล้วอำเภอหรือเขต แล้วตำบลหรือแขวง
// group ต้องมีช่อง addressLine province district subdistrict postalCode
@Component({
  selector: 'app-address-fields',
  standalone: false,
  template: `
    <div class="addr-grid" [formGroup]="group">
      <label class="field wide">
        <span>{{ i18n.t['addressLine'] }}</span>
        <input formControlName="addressLine" type="text" [placeholder]="i18n.t['addressLinePh']">
      </label>
      <label class="field">
        <span>{{ i18n.t['province'] }} *</span>
        <app-select formControlName="province" [options]="provinceOptions" [searchable]="true"
          [searchPlaceholder]="i18n.t['typeToSearch']" [placeholder]="i18n.t['selectProvince']"></app-select>
      </label>
      <label class="field">
        <span>{{ isBangkok ? i18n.t['districtBkk'] : i18n.t['district'] }} *</span>
        <app-select formControlName="district" [options]="districtOptions" [searchable]="true"
          [searchPlaceholder]="i18n.t['typeToSearch']"
          [placeholder]="group.value.province ? (isBangkok ? i18n.t['selectDistrictBkk'] : i18n.t['selectDistrict']) : i18n.t['selectProvinceFirst']"></app-select>
      </label>
      <label class="field">
        <span>{{ isBangkok ? i18n.t['subdistrictBkk'] : i18n.t['subdistrict'] }} *</span>
        <app-select formControlName="subdistrict" [options]="subdistrictOptions" [searchable]="true"
          [searchPlaceholder]="i18n.t['typeToSearch']"
          [placeholder]="group.value.district ? (isBangkok ? i18n.t['selectSubdistrictBkk'] : i18n.t['selectSubdistrict']) : i18n.t['selectDistrictFirst']"></app-select>
      </label>
      <label class="field">
        <span>{{ i18n.t['postalCode'] }}</span>
        <input formControlName="postalCode" type="text" inputmode="numeric" maxlength="5" class="mono">
      </label>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .addr-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .field.wide { grid-column: 1 / -1; }
    .field span { font-size: 12px; color: var(--sub); }
    .field input { border-radius: var(--radius); height: 46px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); color: var(--ink); font-size: 14px; outline: none; }
    .field input:focus { border-color: var(--accent); }
    @media (max-width: 768px) {
      .addr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
})
export class AddressFieldsComponent implements OnInit, OnDestroy {
  @Input() group!: FormGroup;
  // จำกัดจังหวัดที่เลือกได้ตามภาค เช่น หัวหน้าภาคใต้เลือกได้แค่จังหวัดภาคใต้ ไม่ใส่คือเลือกได้ทุกจังหวัด
  @Input() onlyRegion: string | null = null;

  private regionMap: Record<string, string> = {};

  private tree: AddressTree = {};
  private subscriptions = new Subscription();
  // เก็บรายการตัวเลือกไว้ตามค่าที่เลือก จะได้ไม่สร้างรายการใหม่ทุกรอบที่หน้าจอวาดใหม่
  private cache = new Map<string, SelectOption[]>();

  constructor(public i18n: I18nService, private provinceService: ProvinceService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.subscriptions.add(this.provinceService.getRegionMap().subscribe(map => {
      this.regionMap = map;
      this.cache.clear();
      this.cdr.detectChanges();
    }));
    this.subscriptions.add(this.provinceService.getAddressTree().subscribe(tree => {
      this.tree = tree;
      this.cache.clear();
      this.cdr.detectChanges();
    }));

    // เปลี่ยนจังหวัดแล้วอำเภอเดิมไม่อยู่ในจังหวัดใหม่ ให้ล้างอำเภอ ตำบล รหัสไปรษณีย์
    // ข้อมูลยังโหลดไม่เสร็จจะไม่ล้างค่า กันค่าที่ใส่มาตอนเปิดหน้าแก้ไขหายไป
    this.subscriptions.add(this.group.get('province')!.valueChanges.subscribe(province => {
      if (this.isTreeLoaded && !this.tree[province]?.[this.group.value.district]) {
        this.group.patchValue({ district: '', subdistrict: '', postalCode: '' }, { emitEvent: false });
      }
    }));
    this.subscriptions.add(this.group.get('district')!.valueChanges.subscribe(district => {
      if (this.isTreeLoaded && this.tree[this.group.value.province]?.[district]?.[this.group.value.subdistrict] === undefined) {
        this.group.patchValue({ subdistrict: '', postalCode: '' }, { emitEvent: false });
      }
    }));
    // เลือกตำบลแล้วใส่รหัสไปรษณีย์ให้ แก้เองต่อได้
    this.subscriptions.add(this.group.get('subdistrict')!.valueChanges.subscribe(subdistrict => {
      const { province, district } = this.group.value;
      const postalCode = this.tree[province]?.[district]?.[subdistrict];
      if (postalCode) this.group.patchValue({ postalCode }, { emitEvent: false });
    }));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private get isTreeLoaded(): boolean {
    return Object.keys(this.tree).length > 0;
  }

  get isBangkok(): boolean {
    return this.group.value.province === BANGKOK;
  }

  get provinceOptions(): SelectOption[] {
    return this.cached(`p:${this.i18n.lang}:${this.onlyRegion}`, () => Object.keys(this.tree)
      .filter(name => !this.onlyRegion || this.regionMap[name] === this.onlyRegion)
      .map(name => ({ value: name, label: getProvinceLabel(name, this.i18n.lang) }))
      .sort((a, b) => a.label.localeCompare(b.label, this.i18n.lang)));
  }

  get districtOptions(): SelectOption[] {
    const { province } = this.group.value;
    return this.cached(`d:${province}`, () => this.toOptions(Object.keys(this.tree[province] || {})));
  }

  get subdistrictOptions(): SelectOption[] {
    const { province, district } = this.group.value;
    return this.cached(`s:${province}:${district}`, () => this.toOptions(Object.keys(this.tree[province]?.[district] || {})));
  }

  private toOptions(names: string[]): SelectOption[] {
    return names.sort((a, b) => a.localeCompare(b, 'th')).map(name => ({ value: name, label: name }));
  }

  private cached(key: string, build: () => SelectOption[]): SelectOption[] {
    if (!this.cache.has(key)) this.cache.set(key, build());
    return this.cache.get(key)!;
  }
}
