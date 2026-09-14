import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../services/user.service';
import { AuthService, User } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { SelectOption } from '../select/select.component';

@Component({
  selector: 'app-user-settings',
  standalone: false,
  template: `
    <div class="page">
      <div class="card">
        <div class="card-head">
          <div class="head-title">{{ i18n.t['userSettings'] }}</div>
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <form class="add-bar" [formGroup]="form" (ngSubmit)="onSubmit()">
          <label class="field">
            <span>{{ i18n.t['colUsername'] }} *</span>
            <input formControlName="username" type="text" [placeholder]="i18n.t['usernamePh']" autocomplete="off">
          </label>
          <label class="field">
            <span>{{ i18n.t['password'] }} *</span>
            <input formControlName="password" type="password" [placeholder]="i18n.t['passwordPh']" autocomplete="new-password">
          </label>
          <label class="field">
            <span>{{ i18n.t['colFullName'] }} *</span>
            <input formControlName="fullName" type="text" [placeholder]="i18n.t['fullNamePh']">
          </label>
          <label class="field field-narrow">
            <span>{{ i18n.t['role'] }} *</span>
            <app-select formControlName="role" [options]="roleOptions"></app-select>
          </label>
          <button type="submit" [disabled]="form.invalid || saving" class="btn-primary">
            + {{ saving ? i18n.t['saving'] : i18n.t['addUser'] }}
          </button>
        </form>

        <div class="search-bar">
          <div class="search-box">
            <span>⌕</span>
            <input type="text" [(ngModel)]="filterText" [placeholder]="i18n.t['searchList']" (ngModelChange)="applyFilter()">
          </div>
          <span class="mono count">{{ i18n.t['allOf'] }} {{ filteredUsers.length }} / {{ users.length }}</span>
        </div>

        <div *ngIf="loading" class="empty-state">{{ i18n.t['loading'] }}</div>

        <div *ngIf="!loading" class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ i18n.t['colFullName'] }}</th>
                <th>{{ i18n.t['colUsername'] }}</th>
                <th>{{ i18n.t['colRole'] }}</th>
                <th>{{ i18n.t['colStatus'] }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of filteredUsers" [class.inactive-row]="u.active === false">
                <td>{{ u.fullName }}</td>
                <td class="muted mono">{{ u.username }}</td>
                <td>
                  <app-select [ngModel]="u.role" (ngModelChange)="changeRole(u, $event)" [disabled]="isSelf(u)" [options]="roleOptions" [compact]="true"></app-select>
                </td>
                <td>
                  <span class="badge" [class.badge-off]="u.active === false">
                    {{ u.active === false ? i18n.t['inactive'] : i18n.t['active'] }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button *ngIf="u.active !== false" (click)="confirmToggle(u, false)" [disabled]="isSelf(u)" class="btn-delete">
                    {{ i18n.t['deactivate'] }}
                  </button>
                  <button *ngIf="u.active === false" (click)="confirmToggle(u, true)" class="btn-activate">
                    {{ i18n.t['activate'] }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="filteredUsers.length === 0">
                <td colspan="5" class="empty-cell">{{ i18n.t['noResults'] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="toggleTarget" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-title">{{ toggleTarget.next ? i18n.t['confirmActivate'] : i18n.t['confirmDeactivate'] }}</div>
          <div class="modal-body"><strong>{{ toggleTarget.user.fullName }}</strong> · {{ toggleTarget.user.username }}</div>
          <div class="modal-actions">
            <button (click)="doToggle()" [class.btn-activate-solid]="toggleTarget.next" [class.btn-delete-solid]="!toggleTarget.next">
              {{ toggleTarget.next ? i18n.t['activate'] : i18n.t['deactivate'] }}
            </button>
            <button (click)="toggleTarget = null" class="btn-ghost">{{ i18n.t['cancel'] }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 1100px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .add-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 18px 20px; background: var(--alt); border-bottom: 1px solid var(--line2); }
    .field { flex: 1 1 200px; display: flex; flex-direction: column; gap: 6px; }
    .field-narrow { flex: 0 1 170px; }
    .field span { font-size: 12px; color: var(--sub); }
    .field input { border-radius: var(--radius); height: 46px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); color: var(--ink); font-size: 14px; outline: none; }
    .field input:focus { border-color: var(--accent); }
    .btn-primary { border-radius: var(--radius); height: 46px; padding: 0 20px; border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .search-bar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--line2); flex-wrap: wrap; }
    .search-box { border-radius: var(--radius); flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); }
    .search-box span { color: var(--sub); font-size: 13px; }
    .search-box input { border: none; background: transparent; outline: none; font-size: 13.5px; width: 100%; color: var(--ink); }
    .count { font-size: 12.5px; color: var(--sub); }

    .empty-state { text-align: center; padding: 40px 20px; color: var(--sub); }

    .table-scroll { overflow-x: auto; }
    .data-table { width: 100%; min-width: 640px; border-collapse: collapse; }
    .data-table th { background: var(--alt); color: var(--sub); border-bottom: 2px solid var(--accent); text-align: left; padding: 11px 20px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }
    .data-table td { padding: 10px 20px; border-bottom: 1px solid var(--line2); font-size: 13.5px; }
    .inactive-row { opacity: 0.6; }
    .muted { color: var(--sub); }
    .actions-cell { text-align: right; padding-right: 20px; }
    .empty-cell { text-align: center; color: var(--sub); padding: 30px; }

    .badge { border-radius: var(--radius); font-size: 11.5px; font-weight: 600; padding: 3px 9px; color: var(--success-text); background: var(--success-bg); border: 1px solid var(--success-line); }
    .badge-off { color: var(--sub); background: var(--alt); border: 1px solid var(--line2); }

    .btn-delete { border-radius: var(--radius); height: 34px; padding: 0 12px; border: 1px solid var(--danger-line); background: var(--danger-bg); color: var(--danger-text); font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .btn-delete:hover:not(:disabled) { filter: brightness(1.07); }
    .btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-activate { border-radius: var(--radius); height: 34px; padding: 0 12px; border: 1px solid var(--info-line); background: var(--info-bg); color: var(--info-text); font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .btn-activate:hover { filter: brightness(1.07); }

    .modal-overlay { position: fixed; inset: 0; z-index: 20; background: rgba(8, 9, 11, 0.62); display: flex; align-items: center; justify-content: center; padding: 18px; animation: veilIn .16s ease both; }
    .modal-card { border-radius: 16px; width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--line); padding: 24px; animation: modalIn .2s ease both; }
    .modal-title { font-size: 18px; font-weight: 700; }
    .modal-body { margin-top: 10px; font-size: 14px; color: var(--ink); }
    .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
    .modal-actions button { flex: 1; height: 46px; border-radius: var(--radius); font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-delete-solid { border: 1px solid #a5320c; background: #d94a20; color: #fff; }
    .btn-delete-solid:hover { filter: brightness(1.05); }
    .btn-activate-solid { border: 1px solid var(--accent); background: var(--accent); color: #fff; }
    .btn-activate-solid:hover { background: var(--accent-hover); }

    @media (max-width: 768px) {
      .add-bar { flex-direction: column; align-items: stretch; }
      .add-bar .field { flex: 1 1 auto; }
    }
  `]
})
export class UserSettingsComponent implements OnInit {
  form: FormGroup;
  saving = false;
  loading = false;
  users: User[] = [];
  filteredUsers: User[] = [];
  filterText = '';
  toggleTarget: { user: User; next: boolean } | null = null;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    public auth: AuthService,
    public i18n: I18nService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      fullName: ['', Validators.required],
      role: ['technician', Validators.required]
    });
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.lang === 'th' ? 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ' : 'Failed to load users');
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter() {
    const q = this.filterText.trim().toLowerCase();
    this.filteredUsers = q
      ? this.users.filter(u => (u.fullName + u.username).toLowerCase().includes(q))
      : this.users;
  }

  isSelf(u: User): boolean {
    return u._id === this.auth.currentUser?._id;
  }

  get roleOptions(): SelectOption[] {
    return [
      { value: 'technician', label: this.i18n.t['roleTechnician'] },
      { value: 'supervisor', label: this.i18n.t['roleSupervisor'] },
      { value: 'admin', label: this.i18n.t['roleAdmin'] }
    ];
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.saving = true;
    this.userService.createUser(this.form.value).subscribe({
      next: (user) => {
        this.users = [...this.users, user].sort((a, b) => a.fullName.localeCompare(b.fullName));
        this.applyFilter();
        this.toastr.success(`${this.i18n.t['toastUserAdded']} · ${user.fullName}`);
        this.form.reset({ role: 'technician' });
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error');
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  changeRole(u: User, role: string) {
    const previous = u.role;
    this.userService.updateUser(u._id, { role: role as User['role'] }).subscribe({
      next: (updated) => {
        u.role = updated.role;
        this.toastr.success(this.i18n.t['toastUserUpdated']);
        this.cdr.detectChanges();
      },
      error: (err) => {
        u.role = previous;
        this.toastr.error(err.error?.message || 'Error');
        this.cdr.detectChanges();
      }
    });
  }

  confirmToggle(u: User, next: boolean) {
    if (!next && this.isSelf(u)) {
      this.toastr.warning(this.i18n.t['cannotDeactivateSelf']);
      return;
    }
    this.toggleTarget = { user: u, next };
  }

  doToggle() {
    if (!this.toggleTarget) return;
    const { user, next } = this.toggleTarget;

    this.userService.updateUser(user._id, { active: next }).subscribe({
      next: (updated) => {
        user.active = updated.active;
        this.toastr.success(this.i18n.t['toastUserUpdated']);
        this.toggleTarget = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error');
        this.toggleTarget = null;
        this.cdr.detectChanges();
      }
    });
  }

  back() {
    window.history.back();
  }
}
