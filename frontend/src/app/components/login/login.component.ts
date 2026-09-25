import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-login',
  standalone: false,
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="brand-pane">
          <div>
            <div class="mono kicker">SERVICE DISPATCH</div>
            <div class="brand-title">{{ i18n.t['brand'] }}</div>
            <div class="brand-lead">{{ i18n.t['loginLead'] }}</div>
          </div>
          <div class="divider"></div>
          <div class="access-block">
            <div class="mono kicker">{{ i18n.t['access'] }}</div>
            <div class="access-line">{{ i18n.t['accessAll'] }}</div>
            <div class="access-line">{{ i18n.t['accessOwn'] }}</div>
          </div>
          <div class="brand-actions">
            <button [class.on]="i18n.lang === 'th'" (click)="i18n.set('th')">ไทย</button>
            <button [class.on]="i18n.lang === 'en'" (click)="i18n.set('en')">English</button>
            <button class="theme-btn" (click)="theme.toggle()">{{ i18n.t['themeBtn'] }}</button>
          </div>
        </div>

        <form class="form-pane" [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-title">{{ i18n.t['login'] }}</div>
          <label class="field">
            <span>{{ i18n.t['username'] }}</span>
            <input formControlName="username" type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="admin">
          </label>
          <label class="field">
            <span>{{ i18n.t['password'] }}</span>
            <div class="password-wrap">
              <input formControlName="password" [type]="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="••••••••">
              <button type="button" class="toggle-password" (click)="showPassword = !showPassword"
                      [attr.aria-label]="showPassword ? i18n.t['hidePassword'] : i18n.t['showPassword']">
                <svg *ngIf="!showPassword" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg *ngIf="showPassword" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
          </label>
          <button type="submit" [disabled]="form.invalid || loading" class="btn-login">
            {{ loading ? (i18n.lang === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing in...') : i18n.t['login'] }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh; background: var(--chrome); display: flex; align-items: center;
      justify-content: center; padding: 24px;
    }
    .login-card {
      border-radius: var(--radius); width: 100%; max-width: 880px; display: flex; flex-wrap: wrap;
      gap: 1px; background: var(--chrome-line); border: 1px solid var(--chrome-line); overflow: hidden;
    }
    .brand-pane {
      flex: 1 1 340px; min-width: 280px; background: var(--chrome-alt); color: var(--chrome-ink);
      padding: 32px 30px; display: flex; flex-direction: column; gap: 18px;
    }
    .kicker { font-size: 10px; letter-spacing: 0.18em; color: var(--chrome-sub); }
    .brand-title { font-size: 26px; font-weight: 700; line-height: 1.25; margin-top: 8px; }
    .brand-lead { font-size: 14px; color: var(--chrome-sub); line-height: 1.6; margin-top: 10px; }
    .divider { height: 1px; background: var(--chrome-line); }
    .access-block { display: flex; flex-direction: column; gap: 8px; }
    .access-line { font-size: 13px; color: var(--chrome-ink); line-height: 1.7; }
    .brand-actions { display: flex; gap: 8px; margin-top: auto; flex-wrap: wrap; }
    .brand-actions button {
      border-radius: var(--radius); height: 38px; padding: 0 14px; border: 1px solid var(--chrome-line);
      background: transparent; color: var(--chrome-ink); font-size: 12.5px; font-weight: 600; cursor: pointer;
    }
    .brand-actions button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    .brand-actions button:hover { border-color: var(--accent); }

    .form-pane { flex: 1 1 360px; min-width: 280px; background: var(--surface); color: var(--ink); padding: 30px; display: flex; flex-direction: column; gap: 15px; }
    .form-title { font-size: 18px; font-weight: 700; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field span { font-size: 12px; color: var(--sub); }
    .field input {
      border-radius: var(--radius); height: 46px; padding: 0 12px; border: 1px solid var(--line);
      background: var(--field); color: var(--ink); font-size: 14px; outline: none;
    }
    .field input:focus { border-color: var(--accent); }
    .password-wrap { position: relative; }
    .password-wrap input { width: 100%; padding-right: 44px; }
    .toggle-password {
      position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
      width: 38px; height: 38px; border: none; background: transparent; cursor: pointer;
      font-size: 16px; display: flex; align-items: center; justify-content: center; color: var(--sub);
    }
    .toggle-password:hover { color: var(--ink); }
    .btn-login {
      border-radius: var(--radius); height: 50px; border: 1px solid var(--accent); background: var(--accent);
      color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 8px;
    }
    .btn-login:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private toastr: ToastrService,
    private router: Router,
    public theme: ThemeService,
    public i18n: I18nService
  ) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.loading = true;
    const { username, password } = this.form.value;

    this.auth.login(username, password).subscribe({
      next: (user) => {
        this.toastr.success(`${this.i18n.t['toastLogin']} · ${this.i18n.roleLabel(user.role)}`);
        this.router.navigate(['/calendar']);
      },
      error: (err) => {
        this.toastr.error(this.buildLoginErrorMessage(err));
        this.loading = false;
      }
    });
  }

  // backend ส่งมาเป็น code กลางๆ ไม่ผูกภาษา เพื่อให้ error แสดงตามภาษาที่ผู้ใช้เลือกไว้
  private buildLoginErrorMessage(err: any): string {
    const code = err.error?.code;
    if (code === 'login_locked') {
      const mins = err.error?.lockedMinutes;
      return `${this.i18n.t['loginLockedPrefix']} ${mins} ${this.i18n.t['loginLockedSuffix']}`;
    }
    if (code === 'invalid_credentials') {
      const remaining = err.error?.remainingAttempts;
      const base = this.i18n.t['invalidCredentials'];
      if (remaining > 0 && remaining <= 2) {
        const prefix = this.i18n.t['remainingAttemptsPrefix'];
        return `${base} (${prefix ? prefix + ' ' : ''}${remaining} ${this.i18n.t['remainingAttemptsSuffix']})`;
      }
      return base;
    }
    if (code === 'account_deactivated') {
      return this.i18n.t['accountDeactivated'];
    }
    return err.error?.message || this.i18n.t['signInFailed'];
  }
}
