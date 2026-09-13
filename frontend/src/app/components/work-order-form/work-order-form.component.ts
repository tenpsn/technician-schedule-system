import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { WorkOrderService } from '../../services/work-order.service';
import { HospitalService, Hospital } from '../../services/hospital.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-work-order-form',
  standalone: false,
  template: `
    <div class="form-container">
      <div class="header">
        <h2>➕ เพิ่มงานใหม่</h2>
        <button (click)="cancel()" class="btn-back">← กลับ</button>
      </div>
      
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-section">
          <h3>ข้อมูลลูกค้า</h3>
          <div class="form-row">
            <div class="form-group autocomplete-group">
              <label>ชื่อลูกค้า/โรงพยาบาล *</label>
              <input formControlName="customerName" type="text"
                     placeholder="เช่น สูงเนิน"
                     (input)="onCustomerNameInput()"
                     (focus)="onCustomerNameInput()"
                     (blur)="hideSuggestionsDelayed()"
                     autocomplete="off">
              <ul *ngIf="showSuggestions && hospitalSuggestions.length > 0" class="suggestions">
                <li *ngFor="let h of hospitalSuggestions"
                    (mousedown)="selectHospital(h)">
                  <strong>{{ h.name }}</strong> <span class="suggestion-province">{{ h.province }}</span>
                </li>
              </ul>
              <div *ngIf="form.get('customerName')?.invalid &&
                          form.get('customerName')?.touched"
                   class="error">
                กรุณากรอกชื่อลูกค้า
              </div>
            </div>
            <div class="form-group">
              <label>สถานที่ *</label>
              <input formControlName="customerLocation" type="text"
                     placeholder="เช่น สูงเนิน โคราช">
              <div *ngIf="form.get('customerLocation')?.invalid && 
                          form.get('customerLocation')?.touched" 
                   class="error">
                กรุณากรอกสถานที่
              </div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h3>รายละเอียดงาน</h3>
          <div class="form-row">
            <div class="form-group">
              <label>ประเภทงาน *</label>
              <select formControlName="workType" (change)="onWorkTypeChange()">
                <option value="">-- เลือกประเภทงาน --</option>
                <option value="MA">MA (บำรุงรักษา)</option>
                <option value="ติดตั้ง">ติดตั้ง</option>
                <option value="ซ่อม">ซ่อม</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
              <div *ngIf="form.get('workType')?.invalid &&
                          form.get('workType')?.touched"
                   class="error">
                กรุณาเลือกประเภทงาน
              </div>
            </div>
            <div class="form-group" *ngIf="form.get('workType')?.value === 'อื่นๆ'">
              <label>ระบุประเภทงาน *</label>
              <input formControlName="workTypeOther" type="text"
                     placeholder="ระบุประเภทงาน...">
              <div *ngIf="form.get('workTypeOther')?.invalid &&
                          form.get('workTypeOther')?.touched"
                   class="error">
                กรุณาระบุประเภทงาน
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>รายละเอียดงาน</label>
            <textarea formControlName="description" rows="4"
                      placeholder="รายละเอียดงานที่ต้องทำ..."></textarea>
          </div>
        </div>

        <div class="form-section">
          <h3>แผนงาน</h3>
          <div class="form-row">
            <div class="form-group">
              <label>วันที่วางแผน *</label>
              <input formControlName="plannedDate" type="date">
              <div *ngIf="form.get('plannedDate')?.invalid && 
                          form.get('plannedDate')?.touched" 
                   class="error">
                กรุณาเลือกวันที่
              </div>
            </div>
            <div class="form-group">
              <label>เวลาเริ่ม</label>
              <input formControlName="plannedStartTime" type="time">
            </div>
            <div class="form-group">
              <label>เวลาสิ้นสุด</label>
              <input formControlName="plannedEndTime" type="time">
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="submit" [disabled]="form.invalid || loading" class="btn-submit">
            {{ loading ? 'กำลังบันทึก...' : '💾 บันทึกงาน' }}
          </button>
          <button type="button" (click)="cancel()" class="btn-cancel">
            ❌ ยกเลิก
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-container { 
      max-width: 900px; margin: 20px auto; padding: 20px; 
      background: white; border-radius: 8px; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header { 
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0;
    }
    .header h2 { margin: 0; color: #1976d2; }
    .btn-back { 
      padding: 8px 16px; border: 1px solid #ddd; background: white;
      border-radius: 4px; cursor: pointer;
    }
    .btn-back:hover { background: #f5f5f5; }
    
    .form-section { 
      background: #f9f9f9; padding: 20px; margin-bottom: 20px;
      border-radius: 6px;
    }
    .form-section h3 { 
      margin: 0 0 15px 0; color: #333; font-size: 16px;
      border-left: 4px solid #1976d2; padding-left: 10px;
    }
    .form-row { display: flex; gap: 20px; margin-bottom: 15px; flex-wrap: wrap; }
    .form-group { flex: 1; min-width: 200px; }
    .form-group label { 
      display: block; margin-bottom: 5px; font-weight: bold; color: #555;
    }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;
      font-size: 14px; box-sizing: border-box;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      outline: none; border-color: #1976d2; box-shadow: 0 0 0 2px rgba(25,118,210,0.1);
    }
    .error { color: #f44336; font-size: 12px; margin-top: 5px; }

    .autocomplete-group { position: relative; }
    .suggestions {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
      background: white; border: 1px solid #ddd; border-top: none;
      border-radius: 0 0 4px 4px; margin: 0; padding: 0; list-style: none;
      max-height: 220px; overflow-y: auto; box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .suggestions li {
      padding: 8px 12px; cursor: pointer; font-size: 14px;
      display: flex; justify-content: space-between; gap: 10px;
    }
    .suggestions li:hover { background: #e3f2fd; }
    .suggestion-province { color: #888; font-size: 12px; white-space: nowrap; }
    
    .actions { 
      display: flex; gap: 10px; justify-content: flex-end; 
      margin-top: 20px; padding-top: 20px; border-top: 2px solid #f0f0f0;
    }
    .btn-submit, .btn-cancel { 
      padding: 12px 24px; border: none; border-radius: 4px; 
      cursor: pointer; font-weight: bold; font-size: 14px;
    }
    .btn-submit { background: #4caf50; color: white; }
    .btn-submit:disabled { background: #ccc; cursor: not-allowed; }
    .btn-submit:hover:not(:disabled) { background: #45a049; }
    .btn-cancel { background: #f5f5f5; color: #333; }
    .btn-cancel:hover { background: #e0e0e0; }
    
    @media (max-width: 768px) {
      .form-row { flex-direction: column; }
      .actions { flex-direction: column-reverse; }
      .actions button { width: 100%; }
    }
  `]
})
export class WorkOrderFormComponent implements OnInit {
  form: FormGroup;
  loading = false;
  hospitalSuggestions: Hospital[] = [];
  showSuggestions = false;
  private customerNameQuery$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private workOrderService: WorkOrderService,
    private hospitalService: HospitalService,
    private toastr: ToastrService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      customerName: ['', Validators.required],
      customerLocation: ['', Validators.required],
      workType: ['', Validators.required],
      workTypeOther: [''],
      plannedDate: ['', Validators.required],
      plannedStartTime: [''],
      plannedEndTime: [''],
      description: ['']
    });

    this.customerNameQuery$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(query => this.hospitalService.search(query))
    ).subscribe({
      next: (hospitals) => {
        this.hospitalSuggestions = hospitals;
        this.showSuggestions = true;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error searching hospitals:', err)
    });
  }

  ngOnInit() {}

  onWorkTypeChange() {
    const otherControl = this.form.get('workTypeOther');
    if (this.form.get('workType')?.value === 'อื่นๆ') {
      otherControl?.setValidators(Validators.required);
    } else {
      otherControl?.clearValidators();
      otherControl?.setValue('');
    }
    otherControl?.updateValueAndValidity();
  }

  onCustomerNameInput() {
    const query = (this.form.get('customerName')?.value || '').trim();
    if (!query) {
      this.hospitalSuggestions = [];
      this.showSuggestions = false;
      return;
    }
    this.customerNameQuery$.next(query);
  }

  hideSuggestionsDelayed() {
    setTimeout(() => {
      this.showSuggestions = false;
      this.cdr.detectChanges();
    }, 200);
  }

  selectHospital(h: Hospital) {
    this.form.patchValue({
      customerName: h.name,
      customerLocation: h.province
    });
    this.showSuggestions = false;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.toastr.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const { workTypeOther, ...formValue } = this.form.value;
    const payload = {
      ...formValue,
      workType: formValue.workType === 'อื่นๆ' ? workTypeOther.trim() : formValue.workType
    };

    this.workOrderService.create(payload).subscribe({
      next: (res) => {
        this.toastr.success(`สร้างงาน ${res.srNumber} สำเร็จ`);
        this.router.navigate(['/calendar']);
      },
      error: (err) => {
        this.toastr.error('เกิดข้อผิดพลาด: ' + (err.error?.message || err.message));
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancel() {
    this.router.navigate(['/calendar']);
  }
}
