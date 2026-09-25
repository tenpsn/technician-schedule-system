import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { WorkOrderService } from '../../services/work-order.service';
import { HospitalService, Hospital } from '../../services/hospital.service';
import { I18nService } from '../../services/i18n.service';
import { SelectOption } from '../select/select.component';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

// กันไม่ให้บันทึกเวลาจบก่อนเวลาเริ่มไปเงียบๆ
function timeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('plannedStartTime')?.value;
  const end = group.get('plannedEndTime')?.value;
  if (start && end && end <= start) {
    return { timeRange: true };
  }
  return null;
}

const WORK_TYPE_LABELS: Record<string, { th: string; en: string }> = {
  'MA': { th: 'MA (บำรุงรักษา)', en: 'MA (Preventive)' },
  'ติดตั้ง': { th: 'ติดตั้ง', en: 'Installation' },
  'ซ่อม': { th: 'ซ่อม', en: 'Repair' },
  'อื่นๆ': { th: 'อื่นๆ', en: 'Other' }
};

@Component({
  selector: 'app-work-order-form',
  standalone: false,
  template: `
    <div class="page">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="head-title">{{ i18n.t['addJob'] }}</div>
          </div>
          <button (click)="cancel()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="card-body">
            <div class="section">
              <div class="section-title">{{ i18n.t['customerInfo'] }}</div>
              <div class="row">
                <div class="field autocomplete-field">
                  <label>{{ i18n.t['hospitalName'] }} *</label>
                  <input formControlName="customerName" type="text"
                         [placeholder]="i18n.t['sitePh']"
                         (input)="onCustomerNameInput()"
                         (focus)="onCustomerNameInput()"
                         (blur)="hideSuggestionsDelayed()"
                         autocomplete="off">
                  <ul *ngIf="showSuggestions && hospitalSuggestions.length > 0" class="suggestions">
                    <li *ngFor="let h of hospitalSuggestions" (mousedown)="selectHospital(h)">
                      <strong>{{ h.name }}</strong> <span class="muted">{{ h.address }}</span>
                    </li>
                  </ul>
                  <div class="error" *ngIf="form.get('customerName')?.invalid && form.get('customerName')?.touched">
                    {{ i18n.lang === 'th' ? 'กรุณากรอกชื่อลูกค้า' : 'Required' }}
                  </div>
                </div>
                <div class="field">
                  <label>{{ i18n.t['site'] }} *</label>
                  <input formControlName="customerLocation" type="text" [placeholder]="i18n.t['sitePh']">
                  <div class="error" *ngIf="form.get('customerLocation')?.invalid && form.get('customerLocation')?.touched">
                    {{ i18n.lang === 'th' ? 'กรุณากรอกสถานที่' : 'Required' }}
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">{{ i18n.t['jobInfo'] }}</div>
              <div class="row">
                <div class="field">
                  <label>{{ i18n.t['jobType'] }} *</label>
                  <app-select formControlName="workType" [options]="workTypeOptions"></app-select>
                  <div class="error" *ngIf="form.get('workType')?.invalid && form.get('workType')?.touched">
                    {{ i18n.lang === 'th' ? 'กรุณาเลือกประเภทงาน' : 'Required' }}
                  </div>
                </div>
                <div class="field" *ngIf="form.get('workType')?.value === otherWorkType">
                  <label>{{ i18n.lang === 'th' ? 'ระบุประเภทงาน' : 'Specify type' }} *</label>
                  <input formControlName="workTypeOther" type="text">
                  <div class="error" *ngIf="form.get('workTypeOther')?.invalid && form.get('workTypeOther')?.touched">
                    {{ i18n.lang === 'th' ? 'กรุณาระบุประเภทงาน' : 'Required' }}
                  </div>
                </div>
              </div>
              <div class="field">
                <label>{{ i18n.t['jobDesc'] }}</label>
                <textarea formControlName="description" rows="4" [placeholder]="i18n.t['jobDescPh']"></textarea>
              </div>
            </div>

            <div class="section">
              <div class="section-title">{{ i18n.t['planning'] }}</div>
              <div class="row">
                <div class="field">
                  <label>{{ i18n.t['planDate'] }} *</label>
                  <app-date-picker formControlName="plannedDate"></app-date-picker>
                  <div class="error" *ngIf="form.get('plannedDate')?.invalid && form.get('plannedDate')?.touched">
                    {{ i18n.lang === 'th' ? 'กรุณาเลือกวันที่' : 'Required' }}
                  </div>
                </div>
                <div class="field">
                  <label>{{ i18n.t['startTime'] }} *</label>
                  <app-time-picker formControlName="plannedStartTime"></app-time-picker>
                  <div class="error" *ngIf="form.get('plannedStartTime')?.invalid && form.get('plannedStartTime')?.touched">
                    {{ i18n.lang === 'th' ? 'กรุณาเลือกเวลาเริ่ม' : 'Required' }}
                  </div>
                </div>
                <div class="field">
                  <label>{{ i18n.t['endTime'] }} *</label>
                  <app-time-picker formControlName="plannedEndTime"></app-time-picker>
                  <div class="error" *ngIf="form.get('plannedEndTime')?.invalid && form.get('plannedEndTime')?.touched">
                    {{ i18n.lang === 'th' ? 'กรุณาเลือกเวลาสิ้นสุด' : 'Required' }}
                  </div>
                </div>
              </div>
              <div class="error" *ngIf="form.errors?.['timeRange'] && form.get('plannedEndTime')?.touched">
                {{ i18n.lang === 'th' ? 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม' : 'End time must be after start time' }}
              </div>
            </div>
          </div>

          <div class="actions">
            <button type="button" (click)="cancel()" class="btn-ghost">{{ i18n.t['cancel'] }}</button>
            <button type="submit" [disabled]="form.invalid || loading || saved" class="btn-primary">
              {{ saved ? i18n.t['saved'] : loading ? i18n.t['saving'] : i18n.t['saveJob'] }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 900px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .card-body { padding: 20px; display: flex; flex-direction: column; gap: 22px; }
    .section-title { font-size: 13px; font-weight: 700; padding-left: 10px; border-left: 3px solid var(--accent); margin-bottom: 12px; }
    .row { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 14px; }
    .field { flex: 1 1 220px; display: flex; flex-direction: column; gap: 6px; position: relative; }
    .field label { font-size: 12px; color: var(--sub); }
    .field input, .field textarea {
      border-radius: var(--radius); height: 46px; padding: 0 12px; border: 1px solid var(--line);
      background: var(--field); color: var(--ink); font-size: 14px; outline: none;
    }
    .field textarea { height: auto; padding: 10px 12px; resize: vertical; }
    .field input:focus, .field textarea:focus { border-color: var(--accent); }
    .error { color: var(--danger-text); font-size: 12px; }

    .autocomplete-field .suggestions {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 10; margin-top: 2px;
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
      max-height: 220px; overflow-y: auto; padding: 4px; list-style: none;
    }
    .suggestions li { padding: 8px 10px; cursor: pointer; font-size: 14px; border-radius: 8px; display: flex; justify-content: space-between; gap: 10px; }
    .suggestions li:hover { background: var(--info-bg); }
    .muted { color: var(--sub); font-size: 12px; }

    .actions { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--line2); background: var(--alt); }
    .actions button { border-radius: var(--radius); height: 46px; padding: 0 20px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-primary { border: 1px solid var(--accent); background: var(--accent); color: #fff; }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 768px) {
      .row { flex-direction: column; }
      .row .field { flex: 1 1 auto; }
      .actions { flex-direction: column-reverse; }
      .actions button { width: 100%; }
    }
  `]
})
export class WorkOrderFormComponent implements OnInit {
  form: FormGroup;
  loading = false;
  saved = false;
  hospitalSuggestions: Hospital[] = [];
  showSuggestions = false;
  workTypes: string[] = [];
  otherWorkType = '';
  private customerNameQuery$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private workOrderService: WorkOrderService,
    private hospitalService: HospitalService,
    public i18n: I18nService,
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
      plannedStartTime: ['', Validators.required],
      plannedEndTime: ['', Validators.required],
      description: ['']
    }, { validators: timeRangeValidator });

    this.form.get('workType')?.valueChanges.subscribe(() => this.onWorkTypeChange());

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

  ngOnInit() {
    this.workOrderService.getWorkTypes().subscribe(meta => {
      this.workTypes = meta.types;
      this.otherWorkType = meta.otherType;
      this.cdr.detectChanges();
    });
  }

  get workTypeOptions(): SelectOption[] {
    const options: SelectOption[] = [{ value: '', label: this.i18n.t['selectType'] }];
    this.workTypes.forEach(workType => {
      const label = WORK_TYPE_LABELS[workType];
      options.push({ value: workType, label: label ? (this.i18n.lang === 'th' ? label.th : label.en) : workType });
    });
    return options;
  }

  onWorkTypeChange() {
    const otherControl = this.form.get('workTypeOther');
    if (this.form.get('workType')?.value === this.otherWorkType) {
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
      customerLocation: h.address
    });
    this.showSuggestions = false;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.toastr.warning(this.i18n.lang === 'th' ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'Please fill in all required fields');
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const { workTypeOther, ...formValue } = this.form.value;
    let description = formValue.description;
    if (formValue.workType === this.otherWorkType && workTypeOther) {
      // ทำตามรูปแบบเดียวกับ flow อื่นๆ ของ LINE bot คือ workType จะเป็นอื่นๆ เสมอ
      // ส่วนที่ผู้ใช้พิมพ์มาจะถูกเก็บรวมไว้ใน description แทน
      const note = `${this.i18n.t['jobType']}: ${workTypeOther.trim()}`;
      description = description ? `${note}\n${description}` : note;
    }
    const payload = { ...formValue, description };

    this.workOrderService.create(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.saved = true;
        this.toastr.success(`${this.i18n.t['toastSaved']} · ${res.srNumber}`);
        this.cdr.detectChanges();
        setTimeout(() => this.router.navigate(['/calendar']), 700);
      },
      error: (err) => {
        this.toastr.error(this.i18n.errorMessage(err));
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancel() {
    this.router.navigate(['/calendar']);
  }
}
