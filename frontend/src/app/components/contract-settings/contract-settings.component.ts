import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ContractService, Contract, MaVisit } from '../../services/contract.service';
import { HospitalService, Hospital } from '../../services/hospital.service';
import { UserService } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';
import { SelectOption } from '../select/select.component';

// startDate/endDate are "YYYY-MM-DD" strings — safe to compare lexicographically.
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;
  if (start && end && end < start) {
    return { dateRange: true };
  }
  return null;
}

@Component({
  selector: 'app-contract-settings',
  standalone: false,
  template: `
    <div class="page">
      <div class="card">
        <div class="card-head">
          <div class="head-title">{{ i18n.t['contractSettings'] }}</div>
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <form class="add-bar" [formGroup]="form" (ngSubmit)="onSubmit()">
          <label class="field">
            <span>{{ i18n.t['hospitalName'] }} *</span>
            <app-select formControlName="hospitalId" [options]="hospitalOptions" [placeholder]="i18n.t['selectHospital']"></app-select>
          </label>
          <label class="field">
            <span>{{ i18n.t['contractNumber'] }} *</span>
            <input formControlName="contractNumber" type="text" [placeholder]="i18n.t['contractNumberPh']">
          </label>
          <label class="field">
            <span>{{ i18n.t['contractStart'] }} *</span>
            <app-date-picker formControlName="startDate"></app-date-picker>
          </label>
          <label class="field">
            <span>{{ i18n.t['contractEnd'] }} *</span>
            <app-date-picker formControlName="endDate"></app-date-picker>
            <span class="error" *ngIf="form.errors?.['dateRange']">{{ i18n.t['dateRangeError'] }}</span>
          </label>
          <label class="field field-ma">
            <span>{{ i18n.t['contractMaInterval'] }} *</span>
            <div class="ma-input">
              <input formControlName="maIntervalMonths" type="number" min="1" max="12" step="1" [placeholder]="i18n.t['contractMaIntervalPh']">
              <span class="ma-suffix">{{ i18n.t['contractMaIntervalSuffix'] }}</span>
            </div>
          </label>
          <button type="submit" [disabled]="form.invalid || saving" class="btn-primary">
            + {{ saving ? i18n.t['saving'] : i18n.t['addContract'] }}
          </button>
        </form>

        <div class="search-bar">
          <div class="search-box">
            <span>⌕</span>
            <input type="text" [(ngModel)]="filterText" [placeholder]="i18n.t['searchList']" (ngModelChange)="applyFilter()">
          </div>
          <span class="mono count">{{ i18n.t['allOf'] }} {{ filteredContracts.length }} / {{ contracts.length }}</span>
        </div>

        <div *ngIf="loading" class="empty-state">{{ i18n.t['loading'] }}</div>

        <div *ngIf="!loading" class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ i18n.t['hospitalName'] }}</th>
                <th>{{ i18n.t['contractNumber'] }}</th>
                <th>{{ i18n.t['contractStart'] }}</th>
                <th>{{ i18n.t['contractEnd'] }}</th>
                <th class="col-ma">{{ i18n.t['contractMaInterval'] }}</th>
                <th class="col-status">{{ i18n.t['contractStatus'] }}</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of filteredContracts">
                <td>{{ c.hospital?.name }}</td>
                <td class="muted">{{ c.contractNumber }}</td>
                <td class="muted">{{ c.startDate | localDate:'dd/MM/yyyy' }}</td>
                <td class="muted">{{ c.endDate | localDate:'dd/MM/yyyy' }}</td>
                <td class="muted">{{ maLabel(c.maIntervalMonths) }}</td>
                <td><span class="status-badge" [ngClass]="'status-' + contractStatus(c)">{{ statusLabel(c) }}</span></td>
                <td class="actions-cell">
                  <button (click)="openVisits(c)" class="btn-edit">{{ i18n.t['contractVisits'] }}</button>
                  <button (click)="openEdit(c)" class="btn-edit">{{ i18n.t['edit'] }}</button>
                </td>
              </tr>
              <tr *ngIf="filteredContracts.length === 0">
                <td colspan="7" class="empty-cell">{{ i18n.t['noResults'] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div *ngIf="editTarget" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-title">{{ i18n.t['editContractTitle'] }}</div>
          <form [formGroup]="editForm" (ngSubmit)="doEdit()">
            <label class="field modal-field">
              <span>{{ i18n.t['hospitalName'] }} *</span>
              <app-select formControlName="hospitalId" [options]="hospitalOptions" [placeholder]="i18n.t['selectHospital']"></app-select>
            </label>
            <label class="field modal-field">
              <span>{{ i18n.t['contractNumber'] }} *</span>
              <input formControlName="contractNumber" type="text" [placeholder]="i18n.t['contractNumberPh']">
            </label>
            <label class="field modal-field">
              <span>{{ i18n.t['contractStart'] }} *</span>
              <app-date-picker formControlName="startDate"></app-date-picker>
            </label>
            <label class="field modal-field">
              <span>{{ i18n.t['contractEnd'] }} *</span>
              <app-date-picker formControlName="endDate"></app-date-picker>
              <span class="error" *ngIf="editForm.errors?.['dateRange']">{{ i18n.t['dateRangeError'] }}</span>
            </label>
            <label class="field modal-field">
              <span>{{ i18n.t['contractMaInterval'] }} *</span>
              <div class="ma-input">
                <input formControlName="maIntervalMonths" type="number" min="1" max="12" step="1" [placeholder]="i18n.t['contractMaIntervalPh']">
                <span class="ma-suffix">{{ i18n.t['contractMaIntervalSuffix'] }}</span>
              </div>
            </label>
            <div class="modal-actions">
              <button type="submit" [disabled]="editForm.invalid || editSaving" class="btn-primary">
                {{ editSaving ? i18n.t['saving'] : i18n.t['save'] }}
              </button>
              <button type="button" (click)="editTarget = null" class="btn-ghost">{{ i18n.t['cancel'] }}</button>
            </div>
          </form>
        </div>
      </div>

      <div *ngIf="visitsTarget" class="modal-overlay">
        <div class="modal-card modal-card-visits">
          <div class="modal-title">{{ i18n.t['contractVisitsTitle'] }}</div>
          <div class="modal-body">{{ visitsTarget.hospital?.name }} · {{ visitsTarget.contractNumber }}</div>

          <div *ngIf="loadingVisits" class="empty-state">{{ i18n.t['loading'] }}</div>

          <ng-container *ngIf="!loadingVisits">
            <div class="v-grid v-head" *ngIf="visits.length">
              <span></span>
              <span>{{ i18n.t['contractVisitSeq'] }}</span>
              <span>{{ i18n.t['contractVisitDate'] }}</span>
              <span>{{ i18n.t['contractVisitTech'] }}</span>
              <span>{{ i18n.t['contractStatus'] }}</span>
              <span></span>
            </div>

            <div class="visit-timeline" *ngIf="visits.length">
              <div class="v-grid visit-row" *ngFor="let v of visits">
                <span class="tl-dot" [ngClass]="'tl-' + dotClass(v)"></span>

                <span class="v-seq">{{ v.sequenceNo }}</span>

                <span class="v-date">
                  <ng-container *ngIf="!v.workOrder; else staticDate">
                    <app-date-picker [ngModel]="v.scheduledDate" (ngModelChange)="onVisitDateChange(v, $event)"></app-date-picker>
                  </ng-container>
                  <ng-template #staticDate>{{ v.scheduledDate | localDate:'dd/MM/yyyy' }}</ng-template>
                </span>

                <span class="v-tech">
                  <ng-container *ngIf="v.workOrder; else pickTech">
                    <span class="tech-name">{{ v.workOrder.technician?.fullName }}</span>
                  </ng-container>
                  <ng-template #pickTech>
                    <app-select [ngModel]="pendingAssignments[v._id]" (ngModelChange)="pendingAssignments[v._id] = $event"
                                [options]="technicianOptions" [placeholder]="i18n.t['contractSelectTechnician']"></app-select>
                  </ng-template>
                </span>

                <span class="v-status">
                  <ng-container *ngIf="v.workOrder; else pendingBadge">
                    <span class="status-badge" [ngClass]="'status-wo-' + v.workOrder.status">{{ i18n.statusLabel(v.workOrder.status) }}</span>
                  </ng-container>
                  <ng-template #pendingBadge><span class="status-badge status-wo-pending-visit">{{ i18n.t['contractVisitPending'] }}</span></ng-template>
                </span>

                <span class="v-action">
                  <button *ngIf="v.workOrder" type="button" class="btn-edit" (click)="goToWorkOrder(v)">{{ i18n.t['contractViewDetail'] }}</button>
                  <button *ngIf="!v.workOrder" type="button" class="btn-edit"
                          [disabled]="!pendingAssignments[v._id] || assigningVisitId === v._id" (click)="assignVisit(v)">
                    {{ assigningVisitId === v._id ? i18n.t['saving'] : i18n.t['contractAssign'] }}
                  </button>
                </span>
              </div>
            </div>

            <div *ngIf="visits.length === 0" class="empty-cell">{{ i18n.t['contractNoVisits'] }}</div>
          </ng-container>

          <div class="modal-actions">
            <button type="button" (click)="visitsTarget = null" class="btn-ghost">{{ i18n.t['close'] }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 1320px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .add-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 18px 20px; background: var(--alt); border-bottom: 1px solid var(--line2); }
    .field { flex: 1 1 180px; display: flex; flex-direction: column; gap: 6px; }
    .field span { font-size: 12px; color: var(--sub); }
    .field input { border-radius: var(--radius); height: 46px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); color: var(--ink); font-size: 14px; outline: none; }
    .field input:focus { border-color: var(--accent); }
    .error { color: var(--danger-text); font-size: 12px; }
    .field-ma { flex: 0 1 190px; }
    .ma-input { display: flex; align-items: center; gap: 8px; }
    .ma-input input { flex: 1; min-width: 0; text-align: right; }
    .ma-input input::-webkit-outer-spin-button,
    .ma-input input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .ma-input input[type=number] { -moz-appearance: textfield; }
    .ma-suffix {
      flex: none; font-size: 12px; color: var(--sub); white-space: nowrap;
    }
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
    .data-table { width: 100%; min-width: 900px; border-collapse: collapse; }
    .data-table th { background: var(--alt); color: var(--sub); border-bottom: 2px solid var(--accent); text-align: left; padding: 11px 20px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }
    .data-table td { padding: 12px 20px; border-bottom: 1px solid var(--line2); font-size: 13.5px; }
    .muted { color: var(--sub); }
    .col-ma { width: 170px; }
    .col-status { width: 140px; }
    .col-actions { width: 170px; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
    .status-active { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-line); }
    .status-expiring { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-line); }
    .status-expired { background: var(--danger-bg); color: var(--danger-text); border: 1px solid var(--danger-line); }
    .actions-cell { text-align: right; padding-right: 20px; white-space: nowrap; }
    .empty-cell { text-align: center; color: var(--sub); padding: 30px; }
    .btn-edit { border-radius: var(--radius); height: 34px; padding: 0 12px; margin-right: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .btn-edit:hover { border-color: var(--accent); color: var(--accent); }

    .modal-overlay { position: fixed; inset: 0; z-index: 20; background: rgba(8, 9, 11, 0.62); display: flex; align-items: center; justify-content: center; padding: 18px; animation: veilIn .16s ease both; }
    .modal-card { border-radius: 16px; width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--line); padding: 24px; animation: modalIn .2s ease backwards; }
    .modal-title { font-size: 18px; font-weight: 700; }
    .modal-body { margin-top: 10px; font-size: 14px; color: var(--ink); }
    .modal-field { margin-top: 16px; }
    .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
    .modal-actions button { flex: 1; height: 46px; border-radius: var(--radius); font-size: 14px; font-weight: 700; cursor: pointer; }

    .modal-card-visits { max-width: 760px; max-height: 85vh; display: flex; flex-direction: column; }

    .v-grid {
      display: grid;
      grid-template-columns: 14px 26px 190px minmax(140px, 1fr) 108px 116px;
      align-items: center;
      gap: 8px;
    }
    .v-head { margin-top: 16px; padding: 0 4px 8px; border-bottom: 1px solid var(--line);
      font-size: 10.5px; font-weight: 700; color: var(--sub); text-transform: uppercase; letter-spacing: 0.05em; }
    .visit-timeline { position: relative; flex: 1; min-height: 0; overflow-y: auto; }
    .visit-timeline::before { content: ''; position: absolute; left: 10px; top: 16px; bottom: 16px; width: 2px; background: var(--line2); }
    .visit-row { position: relative; padding: 12px 4px; border-bottom: 1px solid var(--line2); }
    .visit-row:last-child { border-bottom: none; }
    .tl-dot { position: relative; z-index: 1; justify-self: center; box-sizing: border-box; width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line2); background: var(--sub); }
    .tl-done { background: var(--success-text); }
    .tl-progress { background: var(--info-text); }
    .tl-upcoming { background: var(--warn-text); }
    .tl-overdue { background: var(--danger-text); }
    .tl-future { background: var(--sub); }
    .tl-cancelled { background: var(--surface); border-color: var(--sub); }
    .v-seq { font-size: 12.5px; font-weight: 700; color: var(--sub); }
    .v-date { font-size: 12.5px; }
    .tech-name { font-weight: 600; font-size: 13px; }
    .v-action { text-align: right; }
    .v-action .btn-edit { margin-right: 0; padding: 0 10px; font-size: 11.5px; white-space: nowrap; }
    .status-wo-draft, .status-wo-cancelled, .status-wo-pending-visit { background: var(--alt); color: var(--sub); border: 1px solid var(--line2); }
    .status-wo-pending_approval, .status-wo-rescheduled { background: var(--warn-bg); color: var(--warn-text); border: 1px solid var(--warn-line); }
    .status-wo-approved, .status-wo-in_progress { background: var(--info-bg); color: var(--info-text); border: 1px solid var(--info-line); }
    .status-wo-completed { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-line); }
    .status-wo-overdue { background: var(--danger-bg); color: var(--danger-text); border: 1px solid var(--danger-line); }

    @media (max-width: 620px) {
      .v-grid { grid-template-columns: 14px 1fr; row-gap: 6px; }
      .v-head { display: none; }
      .v-seq, .v-date, .v-tech, .v-status, .v-action { grid-column: 2; }
      .v-action { text-align: left; }
    }

    @media (max-width: 768px) {
      .add-bar { flex-direction: column; align-items: stretch; }
      .add-bar .field { flex: 1 1 auto; }
    }
  `]
})
export class ContractSettingsComponent implements OnInit {
  form: FormGroup;
  editForm: FormGroup;
  saving = false;
  editSaving = false;
  loading = false;
  contracts: Contract[] = [];
  filteredContracts: Contract[] = [];
  filterText = '';
  hospitalOptions: SelectOption[] = [];
  editTarget: Contract | null = null;
  visitsTarget: Contract | null = null;
  visits: MaVisit[] = [];
  loadingVisits = false;
  technicianOptions: SelectOption[] = [];
  pendingAssignments: Record<string, string> = {};
  assigningVisitId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private contractService: ContractService,
    private hospitalService: HospitalService,
    private userService: UserService,
    private router: Router,
    public i18n: I18nService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      hospitalId: ['', Validators.required],
      contractNumber: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      maIntervalMonths: ['', [Validators.required, Validators.min(1), Validators.max(12)]]
    }, { validators: dateRangeValidator });
    this.editForm = this.fb.group({
      hospitalId: ['', Validators.required],
      contractNumber: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      maIntervalMonths: ['', [Validators.required, Validators.min(1), Validators.max(12)]]
    }, { validators: dateRangeValidator });
  }

  ngOnInit() {
    this.loadHospitals();
    this.loadContracts();
    this.loadTechnicians();
  }

  loadTechnicians() {
    this.userService.getTeamMembers().subscribe({
      next: (users) => {
        this.technicianOptions = users.map(u => ({
          value: u._id,
          label: u.role === 'technician' ? u.fullName : `${u.fullName} (${this.i18n.roleLabel(u.role)})`
        }));
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err)
    });
  }

  maLabel(months: number): string {
    return this.i18n.lang === 'th' ? `ทุก ${months} เดือน` : `Every ${months} months`;
  }

  applyFilter() {
    const q = this.filterText.trim();
    this.filteredContracts = q
      ? this.contracts.filter(c => (c.hospital?.name || '').includes(q) || c.contractNumber.includes(q))
      : this.contracts;
  }

  contractStatus(c: Contract): 'active' | 'expiring' | 'expired' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(c.endDate);
    const diffDays = Math.floor((end.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'active';
  }

  statusLabel(c: Contract): string {
    const status = this.contractStatus(c);
    const key = 'contractStatus' + status.charAt(0).toUpperCase() + status.slice(1);
    return this.i18n.t[key];
  }

  loadHospitals() {
    this.hospitalService.getAll().subscribe({
      next: (hospitals: Hospital[]) => {
        this.hospitalOptions = hospitals.map(h => ({ value: h._id, label: h.name }));
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err)
    });
  }

  loadContracts() {
    this.loading = true;
    this.contractService.getAll().subscribe({
      next: (contracts) => {
        this.contracts = contracts;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.lang === 'th' ? 'โหลดรายการสัญญาไม่สำเร็จ' : 'Failed to load contracts');
        console.error(err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.saving = true;
    const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = this.form.value;

    this.contractService.create(hospitalId, contractNumber, startDate, endDate, maIntervalMonths).subscribe({
      next: (contract) => {
        this.contracts = [contract, ...this.contracts];
        this.applyFilter();
        this.toastr.success(`${this.i18n.t['toastContract']} · ${contract.contractNumber}`);
        this.form.reset();
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.errorMessage(err));
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  openEdit(c: Contract) {
    this.editTarget = c;
    this.editForm.setValue({
      hospitalId: c.hospitalId,
      contractNumber: c.contractNumber,
      startDate: c.startDate,
      endDate: c.endDate,
      maIntervalMonths: c.maIntervalMonths
    });
  }

  doEdit() {
    if (this.editForm.invalid || !this.editTarget) return;
    const target = this.editTarget;
    const { hospitalId, contractNumber, startDate, endDate, maIntervalMonths } = this.editForm.value;

    this.editSaving = true;
    this.contractService.update(target._id, hospitalId, contractNumber, startDate, endDate, maIntervalMonths).subscribe({
      next: (updated) => {
        this.contracts = this.contracts.map(c => c._id === updated._id ? updated : c);
        this.applyFilter();
        this.toastr.success(`${this.i18n.t['toastContractUpdated']} · ${updated.contractNumber}`);
        this.editSaving = false;
        this.editTarget = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.errorMessage(err));
        this.editSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  openVisits(c: Contract) {
    this.visitsTarget = c;
    this.visits = [];
    this.loadingVisits = true;
    this.contractService.getVisits(c._id).subscribe({
      next: (visits) => {
        this.visits = visits;
        this.loadingVisits = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.lang === 'th' ? 'โหลดรอบ MA ไม่สำเร็จ' : 'Failed to load MA visits');
        console.error(err);
        this.loadingVisits = false;
        this.cdr.detectChanges();
      }
    });
  }

  onVisitDateChange(visit: MaVisit, scheduledDate: string) {
    if (!this.visitsTarget || scheduledDate === visit.scheduledDate) return;
    const previous = visit.scheduledDate;
    visit.scheduledDate = scheduledDate;

    this.contractService.updateVisit(this.visitsTarget._id, visit._id, scheduledDate).subscribe({
      next: () => {
        this.toastr.success(this.i18n.t['toastVisitUpdated']);
      },
      error: (err) => {
        visit.scheduledDate = previous;
        this.toastr.error(this.i18n.errorMessage(err));
        this.cdr.detectChanges();
      }
    });
  }

  assignVisit(visit: MaVisit) {
    const technicianId = this.pendingAssignments[visit._id];
    if (!technicianId || !this.visitsTarget) return;

    this.assigningVisitId = visit._id;
    this.contractService.assignVisit(this.visitsTarget._id, visit._id, technicianId).subscribe({
      next: (updated) => {
        this.visits = this.visits.map(v => v._id === updated._id ? updated : v);
        delete this.pendingAssignments[visit._id];
        this.toastr.success(`${this.i18n.t['toastVisitAssigned']} · ${updated.workOrder?.srNumber}`);
        this.assigningVisitId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.errorMessage(err));
        this.assigningVisitId = null;
        this.cdr.detectChanges();
      }
    });
  }

  dotClass(v: MaVisit): 'done' | 'progress' | 'upcoming' | 'overdue' | 'cancelled' | 'future' {
    if (!v.workOrder) return 'future';
    const status = v.workOrder.status;
    if (status === 'completed') return 'done';
    if (status === 'approved' || status === 'in_progress') return 'progress';
    if (status === 'pending_approval' || status === 'rescheduled') return 'upcoming';
    if (status === 'overdue') return 'overdue';
    if (status === 'cancelled') return 'cancelled';
    return 'future';
  }

  goToWorkOrder(visit: MaVisit) {
    if (!visit.workOrder) return;
    this.visitsTarget = null;
    this.router.navigate(['/work-orders', visit.workOrder._id]);
  }

  back() {
    window.history.back();
  }
}
