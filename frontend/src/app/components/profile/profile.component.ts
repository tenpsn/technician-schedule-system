import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, concatMap, of } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { ProvinceService } from '../../services/province.service';
import { Router } from '@angular/router';
import { SelectOption } from '../select/select.component';
import { getProvinceOptions, getRegionLabel } from '../../constants/provinces';

@Component({
  selector: 'app-profile',
  standalone: false,
  template: `
    <div class="page">
      <div class="card">
        <div class="card-head">
          <div class="head-title">{{ i18n.t['myProfile'] }}</div>
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="card-body">
            <div class="identity-row">
              <button type="button" class="avatar" (click)="avatarInput.click()" [disabled]="saving" [title]="i18n.t['changeAvatar']">
                <img *ngIf="avatarPreview; else avatarInitials" [src]="avatarPreview" alt="">
                <ng-template #avatarInitials>{{ initials }}</ng-template>
                <span class="avatar-overlay">📷</span>
              </button>
              <input #avatarInput type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="onAvatarSelected($event)">
              <div class="identity-info">
                <div class="identity-name">{{ auth.currentUser?.fullName }}</div>
                <div class="identity-sub mono">{{ auth.currentUser?.username }} · {{ i18n.roleLabel(auth.currentUser?.role || '') }}</div>
                <div class="avatar-actions">
                  <button type="button" class="btn-link" (click)="avatarInput.click()" [disabled]="saving">{{ i18n.t['changeAvatar'] }}</button>
                  <button type="button" class="btn-link danger" *ngIf="avatarPreview" (click)="removeAvatar()" [disabled]="saving">{{ i18n.t['removeAvatar'] }}</button>
                  <button type="button" class="btn-link muted" *ngIf="avatarChanged" (click)="undoAvatar()" [disabled]="saving">{{ i18n.t['undoAvatar'] }}</button>
                </div>
                <div class="avatar-pending" *ngIf="avatarChanged">{{ i18n.t['avatarPendingHint'] }}</div>
              </div>
            </div>

            <div class="section">
              <div class="row">
                <label class="field">
                  <span>{{ i18n.t['colFullName'] }} *</span>
                  <input formControlName="fullName" type="text">
                </label>
                <label class="field">
                  <span>{{ i18n.t['email'] }} {{ i18n.t['optional'] }}</span>
                  <input formControlName="email" type="email">
                </label>
                <label class="field">
                  <span>{{ i18n.t['phone'] }} {{ i18n.t['optional'] }}</span>
                  <input formControlName="phone" type="text" placeholder="081-234-5678" maxlength="12" (input)="onPhoneInput($event)">
                </label>
              </div>
              <div class="row row-spaced">
                <label class="field">
                  <span>{{ i18n.t['province'] }} *</span>
                  <app-select formControlName="province" [options]="provinceOptions" [placeholder]="i18n.t['selectProvince']"></app-select>
                </label>
                <label class="field">
                  <span>{{ i18n.t['region'] }}</span>
                  <input type="text" [value]="regionDisplay" disabled>
                </label>
              </div>
            </div>

            <div class="section">
              <div class="section-title">{{ i18n.t['changePassword'] }}</div>
              <div class="row">
                <label class="field">
                  <span>{{ i18n.t['currentPassword'] }}</span>
                  <input formControlName="currentPassword" type="password" autocomplete="current-password">
                </label>
                <label class="field">
                  <span>{{ i18n.t['newPassword'] }}</span>
                  <input formControlName="newPassword" type="password" [placeholder]="i18n.t['newPasswordPh']" autocomplete="new-password">
                </label>
              </div>
              <div class="error" *ngIf="form.errors?.['passwordNeedsCurrent'] && form.get('newPassword')?.touched">
                {{ i18n.lang === 'th' ? 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสผ่าน' : 'Enter your current password to set a new one' }}
              </div>
            </div>
          </div>

          <div class="actions">
            <button type="submit" [disabled]="form.invalid || saving" class="btn-primary">
              {{ saving ? i18n.t['saving'] : i18n.t['save'] }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 720px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .card-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
    .identity-row { display: flex; align-items: center; gap: 14px; }
    .avatar { position: relative; overflow: hidden; border-radius: 14px; width: 72px; height: 72px; flex: none; padding: 0; border: none; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 20px; font-weight: 700; font-family: inherit; cursor: pointer; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .avatar-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0, 0, 0, 0.45); font-size: 20px; opacity: 0; transition: opacity .15s; }
    .avatar:hover .avatar-overlay, .avatar:disabled .avatar-overlay { opacity: 1; }
    .identity-info { min-width: 0; }
    .avatar-actions { display: flex; gap: 14px; margin-top: 6px; }
    .btn-link { padding: 0; border: none; background: none; color: var(--accent); font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; }
    .btn-link.danger { color: var(--danger-text); }
    .btn-link.muted { color: var(--sub); }
    .avatar-pending { font-size: 11.5px; color: var(--warn-text); margin-top: 4px; }
    .btn-link:disabled { opacity: 0.6; cursor: not-allowed; }
    .identity-name { font-size: 16px; font-weight: 700; }
    .identity-sub { font-size: 12px; color: var(--sub); margin-top: 2px; }

    .section { border-radius: var(--radius); background: var(--alt); border: 1px solid var(--line2); padding: 16px 18px; }
    .section-title { font-size: 13px; font-weight: 700; padding-left: 10px; border-left: 3px solid var(--accent); margin-bottom: 14px; }
    .row { display: flex; flex-wrap: wrap; gap: 14px; }
    .row-spaced { margin-top: 16px; }
    .field { flex: 1 1 200px; display: flex; flex-direction: column; gap: 6px; }
    .field span { font-size: 12px; color: var(--sub); }
    .field input { border-radius: var(--radius); height: 46px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); color: var(--ink); font-size: 14px; outline: none; }
    .field input:focus { border-color: var(--accent); }
    .field input:disabled { opacity: 0.7; cursor: not-allowed; }
    .error { color: var(--danger-text); font-size: 12px; margin-top: 10px; }

    .actions { display: flex; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid var(--line2); background: var(--alt); }
    .btn-primary { border-radius: var(--radius); height: 46px; padding: 0 24px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 768px) {
      .row { flex-direction: column; }
      .row .field { flex: 1 1 auto; }
    }
  `]
})
export class ProfileComponent implements OnInit, OnDestroy {
  form: FormGroup;
  saving = false;
  pendingAvatar: { file: File; url: string } | null = null;
  avatarRemoved = false;
  regionMap: Record<string, string> = {};

  constructor(
    private fb: FormBuilder,
    public auth: AuthService,
    public i18n: I18nService,
    private provinceService: ProvinceService,
    private toastr: ToastrService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      fullName: ['', Validators.required],
      email: [''],
      phone: [''],
      province: ['', Validators.required],
      currentPassword: [''],
      newPassword: ['', Validators.minLength(6)]
    }, { validators: this.passwordPairValidator });
  }

  ngOnInit() {
    this.form.patchValue({
      fullName: this.auth.currentUser?.fullName || '',
      email: this.auth.currentUser?.email || '',
      phone: this.formatPhone(this.auth.currentUser?.phone || ''),
      province: this.auth.currentUser?.province || ''
    });

    this.auth.getMe().subscribe({
      next: (user) => {
        this.form.patchValue({ email: user.email || '', phone: this.formatPhone(user.phone || ''), province: user.province || '' });
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    this.provinceService.getRegionMap().subscribe(map => {
      this.regionMap = map;
      this.cdr.detectChanges();
    });
  }

  get provinceOptions(): SelectOption[] {
    return getProvinceOptions(this.i18n.lang);
  }

  get regionDisplay(): string {
    const province = this.form.get('province')?.value;
    const region = province ? this.regionMap[province] : '';
    return getRegionLabel(region, this.i18n.lang) || '–';
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatPhone(input.value);
    input.value = formatted;
    this.form.patchValue({ phone: formatted }, { emitEvent: false });
  }

  private formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
    return parts.join('-');
  }

  get initials(): string {
    const name = this.auth.currentUser?.fullName;
    if (!name) return '';
    return name.replace(/\s+/g, ' ').split(' ')[0].slice(0, 2);
  }

  private passwordPairValidator(group: FormGroup) {
    const newPassword = group.get('newPassword')?.value;
    const currentPassword = group.get('currentPassword')?.value;
    if (newPassword && !currentPassword) {
      return { passwordNeedsCurrent: true };
    }
    return null;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, email, phone, province, currentPassword, newPassword } = this.form.value;
    const payload: any = { fullName, email, phone, province };
    if (newPassword) {
      payload.password = newPassword;
      payload.currentPassword = currentPassword;
    }

    // บันทึกข้อมูลในฟอร์มก่อน แล้วค่อยอัปโหลดหรือลบรูปที่เลือกค้างไว้
    const avatarStep: Observable<unknown> = this.pendingAvatar
      ? this.auth.uploadAvatar(this.pendingAvatar.file)
      : this.avatarRemoved ? this.auth.removeAvatar() : of(null);

    this.saving = true;
    this.auth.updateProfile(payload).pipe(concatMap(() => avatarStep)).subscribe({
      next: () => {
        this.saving = false;
        this.clearPendingAvatar();
        this.toastr.success(this.i18n.t['toastProfileUpdated']);
        this.form.patchValue({ currentPassword: '', newPassword: '' });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.toastr.error(this.i18n.errorMessage(err));
        this.cdr.detectChanges();
      }
    });
  }

  // รูปที่เลือกแสดงเป็นตัวอย่างไว้ก่อน ยังไม่บันทึกจนกว่าจะกดปุ่มบันทึกของฟอร์ม
  get avatarPreview(): string | null {
    if (this.pendingAvatar) return this.pendingAvatar.url;
    return this.avatarRemoved ? null : this.auth.avatarSrc;
  }

  get avatarChanged(): boolean {
    return !!this.pendingAvatar || this.avatarRemoved;
  }

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.clearPendingAvatar();
    this.pendingAvatar = { file, url: URL.createObjectURL(file) };
  }

  removeAvatar() {
    this.clearPendingAvatar();
    // ถ้ายังไม่เคยมีรูปบน server การลบแค่ยกเลิกรูปที่เพิ่งเลือก ไม่ต้องเรียกลบอะไร
    this.avatarRemoved = !!this.auth.currentUser?.avatarUrl;
  }

  undoAvatar() {
    this.clearPendingAvatar();
  }

  private clearPendingAvatar() {
    if (this.pendingAvatar) URL.revokeObjectURL(this.pendingAvatar.url);
    this.pendingAvatar = null;
    this.avatarRemoved = false;
  }

  ngOnDestroy() {
    this.clearPendingAvatar();
  }

  back() {
    this.router.navigate(['/calendar']);
  }
}
