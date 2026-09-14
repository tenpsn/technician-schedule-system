import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { HospitalService, Hospital } from '../../services/hospital.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-hospital-settings',
  standalone: false,
  template: `
    <div class="page">
      <div class="card">
        <div class="card-head">
          <div class="head-title">{{ i18n.t['hospitalSettings'] }}</div>
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <form class="add-bar" [formGroup]="form" (ngSubmit)="onSubmit()">
          <label class="field">
            <span>{{ i18n.t['hospitalName'] }} *</span>
            <input formControlName="name" type="text" [placeholder]="i18n.t['hospitalNamePh']">
          </label>
          <label class="field">
            <span>{{ i18n.t['province'] }} *</span>
            <input formControlName="province" type="text" [placeholder]="i18n.t['provincePh']">
          </label>
          <button type="submit" [disabled]="form.invalid || saving" class="btn-primary">
            + {{ saving ? i18n.t['saving'] : i18n.t['addHospital'] }}
          </button>
        </form>

        <div class="search-bar">
          <div class="search-box">
            <span>⌕</span>
            <input type="text" [(ngModel)]="filterText" [placeholder]="i18n.t['searchList']" (ngModelChange)="applyFilter()">
          </div>
          <span class="mono count">{{ i18n.t['allOf'] }} {{ filteredHospitals.length }} / {{ hospitals.length }}</span>
        </div>

        <div *ngIf="loading" class="empty-state">{{ i18n.t['loading'] }}</div>

        <div *ngIf="!loading" class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ i18n.t['hospitalName'] }}</th>
                <th>{{ i18n.t['province'] }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of filteredHospitals">
                <td>{{ h.name }}</td>
                <td class="muted">{{ h.province }}</td>
                <td class="actions-cell">
                  <button (click)="confirmDelete(h)" class="btn-delete">{{ i18n.t['delete'] }}</button>
                </td>
              </tr>
              <tr *ngIf="filteredHospitals.length === 0">
                <td colspan="3" class="empty-cell">{{ i18n.t['noResults'] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="deleteTarget" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-title">{{ i18n.lang === 'th' ? 'ลบโรงพยาบาลนี้?' : 'Delete this hospital?' }}</div>
          <div class="modal-body"><strong>{{ deleteTarget.name }}</strong> ({{ deleteTarget.province }})</div>
          <div class="modal-actions">
            <button (click)="doDelete()" class="btn-delete-solid">{{ i18n.t['delete'] }}</button>
            <button (click)="deleteTarget = null" class="btn-ghost">{{ i18n.t['cancel'] }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 980px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .add-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 18px 20px; background: var(--alt); border-bottom: 1px solid var(--line2); }
    .field { flex: 1 1 220px; display: flex; flex-direction: column; gap: 6px; }
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
    .data-table { width: 100%; min-width: 420px; border-collapse: collapse; }
    .data-table th { background: var(--alt); color: var(--sub); border-bottom: 2px solid var(--accent); text-align: left; padding: 11px 20px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }
    .data-table td { padding: 12px 20px; border-bottom: 1px solid var(--line2); font-size: 13.5px; }
    .muted { color: var(--sub); }
    .actions-cell { text-align: right; padding-right: 20px; }
    .empty-cell { text-align: center; color: var(--sub); padding: 30px; }
    .btn-delete { border-radius: var(--radius); height: 34px; padding: 0 12px; border: 1px solid var(--danger-line); background: var(--danger-bg); color: var(--danger-text); font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .btn-delete:hover { filter: brightness(1.07); }

    .modal-overlay { position: fixed; inset: 0; z-index: 20; background: rgba(8, 9, 11, 0.62); display: flex; align-items: center; justify-content: center; padding: 18px; animation: veilIn .16s ease both; }
    .modal-card { border-radius: 16px; width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--line); padding: 24px; animation: modalIn .2s ease both; }
    .modal-title { font-size: 18px; font-weight: 700; }
    .modal-body { margin-top: 10px; font-size: 14px; color: var(--ink); }
    .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
    .modal-actions button { flex: 1; height: 46px; border-radius: var(--radius); font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-delete-solid { border: 1px solid #a5320c; background: #d94a20; color: #fff; }
    .btn-delete-solid:hover { filter: brightness(1.05); }

    @media (max-width: 768px) {
      .add-bar { flex-direction: column; align-items: stretch; }
      .add-bar .field { flex: 1 1 auto; }
    }
  `]
})
export class HospitalSettingsComponent implements OnInit {
  form: FormGroup;
  saving = false;
  loading = false;
  hospitals: Hospital[] = [];
  filteredHospitals: Hospital[] = [];
  filterText = '';
  deleteTarget: Hospital | null = null;

  constructor(
    private fb: FormBuilder,
    private hospitalService: HospitalService,
    public i18n: I18nService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      province: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.loadHospitals();
  }

  loadHospitals() {
    this.loading = true;
    this.hospitalService.getAll().subscribe({
      next: (hospitals) => {
        this.hospitals = hospitals;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.lang === 'th' ? 'โหลดรายชื่อโรงพยาบาลไม่สำเร็จ' : 'Failed to load hospitals');
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter() {
    const q = this.filterText.trim();
    this.filteredHospitals = q
      ? this.hospitals.filter(h => h.name.includes(q) || h.province.includes(q))
      : this.hospitals;
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.saving = true;
    const { name, province } = this.form.value;

    this.hospitalService.create(name, province).subscribe({
      next: (hospital) => {
        this.hospitals = [...this.hospitals, hospital].sort((a, b) => a.name.localeCompare(b.name));
        this.applyFilter();
        this.toastr.success(`${this.i18n.t['toastHospital']} · ${hospital.name}`);
        this.form.reset();
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

  confirmDelete(h: Hospital) {
    this.deleteTarget = h;
  }

  doDelete() {
    if (!this.deleteTarget) return;
    const target = this.deleteTarget;

    this.hospitalService.delete(target._id).subscribe({
      next: () => {
        this.hospitals = this.hospitals.filter(h => h._id !== target._id);
        this.applyFilter();
        this.toastr.success(`${this.i18n.t['toastDeleted']} · ${target.name}`);
        this.deleteTarget = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error');
        this.deleteTarget = null;
        this.cdr.detectChanges();
      }
    });
  }

  back() {
    window.history.back();
  }
}
