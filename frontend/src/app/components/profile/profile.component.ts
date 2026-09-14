import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { Router } from '@angular/router';

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
              <div class="avatar">{{ initials }}</div>
              <div>
                <div class="identity-name">{{ auth.currentUser?.fullName }}</div>
                <div class="identity-sub mono">{{ auth.currentUser?.username }} · {{ i18n.roleLabel(auth.currentUser?.role || '') }}</div>
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
    .avatar { border-radius: 10px; width: 46px; height: 46px; flex: none; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 15px; font-weight: 700; }
    .identity-name { font-size: 16px; font-weight: 700; }
    .identity-sub { font-size: 12px; color: var(--sub); margin-top: 2px; }

    .section { border-radius: var(--radius); background: var(--alt); border: 1px solid var(--line2); padding: 16px 18px; }
    .section-title { font-size: 13px; font-weight: 700; padding-left: 10px; border-left: 3px solid var(--accent); margin-bottom: 14px; }
    .row { display: flex; flex-wrap: wrap; gap: 14px; }
    .field { flex: 1 1 200px; display: flex; flex-direction: column; gap: 6px; }
    .field span { font-size: 12px; color: var(--sub); }
    .field input { border-radius: var(--radius); height: 46px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); color: var(--ink); font-size: 14px; outline: none; }
    .field input:focus { border-color: var(--accent); }
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
export class ProfileComponent implements OnInit {
  form: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    public auth: AuthService,
    public i18n: I18nService,
    private toastr: ToastrService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      fullName: ['', Validators.required],
      email: [''],
      phone: [''],
      currentPassword: [''],
      newPassword: ['', Validators.minLength(6)]
    }, { validators: this.passwordPairValidator });
  }

  ngOnInit() {
    this.form.patchValue({
      fullName: this.auth.currentUser?.fullName || '',
      email: this.auth.currentUser?.email || '',
      phone: this.formatPhone(this.auth.currentUser?.phone || '')
    });

    this.auth.getMe().subscribe({
      next: (user) => {
        this.form.patchValue({ email: user.email || '', phone: this.formatPhone(user.phone || '') });
        this.cdr.detectChanges();
      },
      error: () => {}
    });
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

    const { fullName, email, phone, currentPassword, newPassword } = this.form.value;
    const payload: any = { fullName, email, phone };
    if (newPassword) {
      payload.password = newPassword;
      payload.currentPassword = currentPassword;
    }

    this.saving = true;
    this.auth.updateProfile(payload).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.success(this.i18n.t['toastProfileUpdated']);
        this.form.patchValue({ currentPassword: '', newPassword: '' });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.toastr.error(err.error?.message || 'Error');
        this.cdr.detectChanges();
      }
    });
  }

  back() {
    this.router.navigate(['/calendar']);
  }
}
