import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  template: `
    <div class="login-container">
      <form class="login-card" [formGroup]="form" (ngSubmit)="onSubmit()">
        <h2>🔧 ระบบจัดการงานช่าง</h2>

        <div class="form-group">
          <label>ชื่อผู้ใช้</label>
          <input formControlName="username" type="text" autocomplete="username">
        </div>

        <div class="form-group">
          <label>รหัสผ่าน</label>
          <input formControlName="password" type="password" autocomplete="current-password">
        </div>

        <button type="submit" [disabled]="form.invalid || loading" class="btn-login">
          {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #f5f5f5;
    }
    .login-card {
      background: white; padding: 40px; border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1); width: 100%; max-width: 360px;
    }
    .login-card h2 { margin: 0 0 24px 0; color: #1976d2; text-align: center; font-size: 20px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
    .form-group input {
      width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;
      font-size: 14px; box-sizing: border-box;
    }
    .form-group input:focus {
      outline: none; border-color: #1976d2; box-shadow: 0 0 0 2px rgba(25,118,210,0.1);
    }
    .btn-login {
      width: 100%; padding: 12px; border: none; border-radius: 4px;
      background: #1976d2; color: white; font-weight: bold; font-size: 14px;
      cursor: pointer; margin-top: 8px;
    }
    .btn-login:disabled { background: #ccc; cursor: not-allowed; }
    .btn-login:hover:not(:disabled) { background: #1565c0; }
  `]
})
export class LoginComponent {
  form: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private toastr: ToastrService,
    private router: Router
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
      next: () => {
        this.router.navigate(['/calendar']);
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'เข้าสู่ระบบไม่สำเร็จ');
        this.loading = false;
      }
    });
  }
}
