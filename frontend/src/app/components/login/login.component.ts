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
            <input formControlName="password" type="password" autocomplete="current-password" placeholder="••••••••">
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
        this.toastr.error(err.error?.message || (this.i18n.lang === 'th' ? 'เข้าสู่ระบบไม่สำเร็จ' : 'Sign in failed'));
        this.loading = false;
      }
    });
  }
}
