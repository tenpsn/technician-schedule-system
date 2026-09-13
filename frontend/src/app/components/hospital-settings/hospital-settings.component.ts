import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { HospitalService, Hospital } from '../../services/hospital.service';

@Component({
  selector: 'app-hospital-settings',
  standalone: false,
  template: `
    <div class="container">
      <div class="header">
        <h2>🏥 ตั้งค่ารายชื่อโรงพยาบาล</h2>
        <button (click)="back()" class="btn-back">← กลับ</button>
      </div>

      <form class="add-form" [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label>ชื่อโรงพยาบาล *</label>
          <input formControlName="name" type="text" placeholder="เช่น สูงเนิน">
        </div>
        <div class="form-group">
          <label>จังหวัด *</label>
          <input formControlName="province" type="text" placeholder="เช่น นครราชสีมา">
        </div>
        <button type="submit" [disabled]="form.invalid || saving" class="btn-add">
          {{ saving ? 'กำลังเพิ่ม...' : '➕ เพิ่มโรงพยาบาล' }}
        </button>
      </form>

      <div class="search-box">
        <input type="text" [(ngModel)]="filterText" placeholder="🔍 ค้นหาในรายการ..." (ngModelChange)="applyFilter()">
        <span class="count">ทั้งหมด {{ filteredHospitals.length }} / {{ hospitals.length }} รายการ</span>
      </div>

      <div *ngIf="loading" class="loading">กำลังโหลด...</div>

      <table *ngIf="!loading" class="data-table">
        <thead>
          <tr>
            <th>ชื่อโรงพยาบาล</th>
            <th>จังหวัด</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let h of filteredHospitals">
            <td>{{ h.name }}</td>
            <td>{{ h.province }}</td>
            <td class="actions-cell">
              <button (click)="confirmDelete(h)" class="btn-delete">🗑️ ลบ</button>
            </td>
          </tr>
          <tr *ngIf="filteredHospitals.length === 0">
            <td colspan="3" class="empty-cell">ไม่พบข้อมูล</td>
          </tr>
        </tbody>
      </table>

      <div *ngIf="deleteTarget" class="modal">
        <div class="modal-content">
          <h3>ลบโรงพยาบาลนี้?</h3>
          <p><strong>{{ deleteTarget.name }}</strong> ({{ deleteTarget.province }})</p>
          <div class="modal-actions">
            <button (click)="doDelete()" class="btn-confirm">✅ ลบ</button>
            <button (click)="deleteTarget = null" class="btn-cancel-modal">❌ ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 900px; margin: 20px auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0; }
    .header h2 { margin: 0; color: #1976d2; }
    .btn-back { padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; }
    .btn-back:hover { background: #f5f5f5; }

    .add-form { display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap; padding: 15px; background: #f9f9f9; border-radius: 6px; margin-bottom: 20px; }
    .form-group { flex: 1; min-width: 180px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; font-size: 13px; }
    .form-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
    .btn-add { padding: 10px 20px; border: none; border-radius: 4px; background: #4caf50; color: white; font-weight: bold; cursor: pointer; }
    .btn-add:disabled { background: #ccc; cursor: not-allowed; }
    .btn-add:hover:not(:disabled) { background: #45a049; }

    .search-box { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
    .search-box input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .count { color: #666; font-size: 13px; white-space: nowrap; }

    .loading { text-align: center; padding: 40px; color: #666; }

    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px 15px; text-align: left; border-bottom: 1px solid #eee; }
    .data-table th { background: #1976d2; color: white; }
    .data-table tr:hover { background: #f5f5f5; }
    .actions-cell { text-align: right; }
    .empty-cell { text-align: center; color: #999; padding: 30px; }
    .btn-delete { padding: 6px 12px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer; font-size: 12px; }
    .btn-delete:hover { background: #d32f2f; }

    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; max-width: 400px; width: 100%; }
    .modal-content h3 { margin: 0 0 15px 0; color: #333; }
    .modal-actions { display: flex; gap: 10px; margin-top: 25px; }
    .modal-actions button { flex: 1; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; }
    .btn-confirm { background: #f44336; color: white; }
    .btn-cancel-modal { background: #f5f5f5; color: #333; }

    @media (max-width: 768px) {
      .add-form { flex-direction: column; align-items: stretch; }
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
        this.toastr.error('โหลดรายชื่อโรงพยาบาลไม่สำเร็จ');
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
        this.toastr.success(`เพิ่ม ${hospital.name} สำเร็จ`);
        this.form.reset();
        this.saving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'เกิดข้อผิดพลาด');
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
        this.toastr.success(`ลบ ${target.name} สำเร็จ`);
        this.deleteTarget = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'เกิดข้อผิดพลาด');
        this.deleteTarget = null;
        this.cdr.detectChanges();
      }
    });
  }

  back() {
    window.history.back();
  }
}
