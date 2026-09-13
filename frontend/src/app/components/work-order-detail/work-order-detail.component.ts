import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkOrderService, WorkOrder } from '../../services/work-order.service';
import { AuthService } from '../../services/auth.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-work-order-detail',
  standalone: false,
  template: `
    <div class="detail-container" *ngIf="order">
      <div class="header">
        <button (click)="back()" class="btn-back">← กลับ</button>
        <h2>รายละเอียดงาน: {{ order.srNumber }}</h2>
      </div>
      
      <div class="status-badge" [class]="order.status">
        {{ getStatusText(order.status) }}
      </div>

      <div *ngIf="order.isOverdue" class="alert-box alert-warning">
        ⚠️ งานค้าง {{ order.overdueDays }} วัน
      </div>

      <!-- แสดงข้อมูลการยกเลิก -->
      <div *ngIf="order.status === 'cancelled'" class="alert-box alert-cancelled">
        <h3>🚫 งานนี้ถูกยกเลิกแล้ว</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>ผู้ยกเลิก</label>
            <div>{{ order.cancelledBy?.fullName }}</div>
          </div>
          <div class="info-item">
            <label>เวลายกเลิก</label>
            <div>{{ order.cancelledAt | date:'dd/MM/yyyy HH:mm' }}</div>
          </div>
        </div>
        <div class="cancel-reason">
          <label>เหตุผลการยกเลิก</label>
          <p>{{ order.cancelReason }}</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <label>ลูกค้า</label>
          <div class="value">{{ order.customerName }}</div>
        </div>
        <div class="info-item">
          <label>สถานที่</label>
          <div class="value">{{ order.customerLocation }}</div>
        </div>
        <div class="info-item">
          <label>ประเภทงาน</label>
          <div class="value">{{ order.workType }}</div>
        </div>
        <div class="info-item">
          <label>ช่างผู้รับผิดชอบ</label>
          <div class="value">{{ order.technician?.fullName }}</div>
        </div>
      </div>

      <!-- Planning Section -->
      <div class="section">
        <h3>📋 Planning (แผนงาน)</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>วันที่วางแผน</label>
            <div class="value">{{ order.plannedDate | date:'dd/MM/yyyy' }}</div>
          </div>
          <div class="info-item">
            <label>เวลา</label>
            <div class="value">{{ order.plannedStartTime }} - {{ order.plannedEndTime }}</div>
          </div>
        </div>
        <div *ngIf="order.description" class="description">
          <label>รายละเอียด</label>
          <p>{{ order.description }}</p>
        </div>
      </div>

      <!-- Actual Section -->
      <div class="section" *ngIf="order.actualDescription">
        <h3>✅ Actual (งานจริง)</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>วันที่ทำงานจริง</label>
            <div class="value">{{ order.actualDate | date:'dd/MM/yyyy' }}</div>
          </div>
          <div class="info-item">
            <label>เวลา</label>
            <div class="value">{{ order.actualStartTime }} - {{ order.actualEndTime }}</div>
          </div>
          <div class="info-item">
            <label>สถานที่จริง</label>
            <div class="value">{{ order.actualLocation }}</div>
          </div>
        </div>
        <div class="description">
          <label>รายละเอียดงานจริง</label>
          <p>{{ order.actualDescription }}</p>
        </div>
      </div>

      <!-- Reschedule History -->
      <div class="section" *ngIf="(order.rescheduleHistory?.length ?? 0) > 0">
        <h3>🔄 ประวัติการเลื่อน</h3>
        <div *ngFor="let h of order.rescheduleHistory" class="history-item">
          <div class="history-date">
            {{ h.fromDate | date:'dd/MM/yyyy' }} → {{ h.toDate | date:'dd/MM/yyyy' }}
          </div>
          <div class="history-reason">เหตุผล: {{ h.reason }}</div>
          <div class="history-by">โดย: {{ h.changedBy?.fullName || 'ไม่ทราบ' }} | {{ h.changedAt | date:'dd/MM/yyyy HH:mm' }}</div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="actions" *ngIf="order.status !== 'cancelled' && order.status !== 'completed'">
        <button *ngIf="canUpdateActual" (click)="showActualForm = true" class="btn-actual">
           บันทึกงานจริง
        </button>
        
        <button *ngIf="canReschedule" (click)="showRescheduleForm = true" class="btn-reschedule">
          🔄 เลื่อนงาน
        </button>
        
        <button *ngIf="canCancel" (click)="showCancelForm = true" class="btn-cancel-action">
           ยกเลิกงาน
        </button>
        
        <button *ngIf="canApprove" (click)="approve()" class="btn-approve">
          ✅ อนุมัติแผนงาน
        </button>
      </div>

      <!-- Cancel Form Modal -->
      <div *ngIf="showCancelForm" class="modal">
        <div class="modal-content">
          <h3> ยกเลิกงาน</h3>
          <div class="warning-box">
            ⚠️ การยกเลิกงานจะไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลให้ชัดเจน
          </div>
          <form [formGroup]="cancelForm" (ngSubmit)="submitCancel()">
            <div class="form-group">
              <label>เหตุผลการยกเลิก *</label>
              <textarea formControlName="cancelReason" rows="4"
                        placeholder="เช่น ลูกค้าขอยกเลิก, อุปกรณ์ไม่พร้อม, ติดงานอื่นที่เร่งด่วนกว่า..."></textarea>
              <div *ngIf="cancelForm.get('cancelReason')?.invalid &&
                          cancelForm.get('cancelReason')?.touched"
                   class="error-message">
                กรุณาระบุเหตุผลการยกเลิก
              </div>
            </div>
            
            <div class="quick-reasons">
              <label>เหตุผลทั่วไป (คลิกเพื่อเลือก):</label>
              <div class="reason-buttons">
                <button type="button" (click)="setQuickReason('ลูกค้าขอยกเลิกเนื่องจากเปลี่ยนผู้ให้บริการ')">ลูกค้าขอยกเลิก</button>
                <button type="button" (click)="setQuickReason('อุปกรณ์/อะไหล่ไม่พร้อม')">อุปกรณ์ไม่พร้อม</button>
                <button type="button" (click)="setQuickReason('ติดงานอื่นที่เร่งด่วนกว่า')">ติดงานเร่งด่วน</button>
                <button type="button" (click)="setQuickReason('สภาพอากาศไม่เอื้ออำนวย')">สภาพอากาศ</button>
                <button type="button" (click)="setQuickReason('ลูกค้าเลื่อนออกไปไม่มีกำหนด')">ลูกค้าเลื่อนไม่มีกำหนด</button>
                <button type="button" (click)="setQuickReason('อื่นๆ (ระบุเอง)')">อื่นๆ</button>
              </div>
            </div>
            
            <div class="modal-actions">
              <button type="submit" [disabled]="cancelForm.invalid" class="btn-confirm-cancel">
                ✅ ยืนยันการยกเลิก
              </button>
              <button type="button" (click)="showCancelForm = false" class="btn-cancel-modal">
                ❌ กลับ
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Actual Form Modal -->
      <div *ngIf="showActualForm" class="modal">
        <div class="modal-content">
          <h3>📝 บันทึกงานจริง (Actual)</h3>
          <form [formGroup]="actualForm" (ngSubmit)="submitActual()">
            <div class="form-group">
              <label>วันที่ทำงานจริง *</label>
              <input formControlName="actualDate" type="date">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>เวลาเริ่ม</label>
                <input formControlName="actualStartTime" type="time">
              </div>
              <div class="form-group">
                <label>เวลาสิ้นสุด</label>
                <input formControlName="actualEndTime" type="time">
              </div>
            </div>
            <div class="form-group">
              <label>สถานที่จริง</label>
              <input formControlName="actualLocation" type="text" 
                     [value]="order.customerLocation">
            </div>
            <div class="form-group">
              <label>รายละเอียดงานที่ทำได้จริง *</label>
              <textarea formControlName="actualDescription" rows="4"
                        placeholder="บรรยายงานที่ได้ทำจริง..."></textarea>
            </div>
            <div class="modal-actions">
              <button type="submit" class="btn-submit">💾 บันทึก</button>
              <button type="button" (click)="showActualForm = false" class="btn-cancel-modal">❌ ยกเลิก</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Reschedule Form Modal -->
      <div *ngIf="showRescheduleForm" class="modal">
        <div class="modal-content">
          <h3>🔄 เลื่อนงาน</h3>
          <form [formGroup]="rescheduleForm" (ngSubmit)="submitReschedule()">
            <div class="form-group">
              <label>วันที่ใหม่ *</label>
              <input formControlName="newDate" type="date">
            </div>
            <div class="form-group">
              <label>เหตุผลที่เลื่อน *</label>
              <textarea formControlName="reason" rows="3"
                        placeholder="อธิบายเหตุผลที่ต้องเลื่อน..."></textarea>
              <div *ngIf="rescheduleForm.get('reason')?.invalid &&
                          rescheduleForm.get('reason')?.touched"
                   class="error-message">
                กรุณาระบุเหตุผลที่เลื่อน
              </div>
            </div>
            <div class="modal-actions">
              <button type="submit" class="btn-submit">✅ ยืนยันการเลื่อน</button>
              <button type="button" (click)="showRescheduleForm = false" class="btn-cancel-modal">❌ ยกเลิก</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-container { max-width: 1000px; margin: 20px auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
    .btn-back { padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; }
    .btn-back:hover { background: #f5f5f5; }
    .header h2 { margin: 0; color: #1976d2; }
    
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: bold; margin-bottom: 15px; font-size: 14px; }
    .status-badge.approved { background: #e8f5e9; color: #2e7d32; }
    .status-badge.pending_approval { background: #fff3e0; color: #ef6c00; }
    .status-badge.completed { background: #e3f2fd; color: #1565c0; }
    .status-badge.overdue { background: #ffebee; color: #c62828; }
    .status-badge.cancelled { background: #424242; color: white; }
    .status-badge.draft { background: #f5f5f5; color: #616161; }
    .status-badge.in_progress { background: #fff9c4; color: #f57f17; }
    
    .alert-box { padding: 15px; border-radius: 4px; margin-bottom: 20px; }
    .alert-warning { background: #fff3e0; border-left: 4px solid #ff9800; color: #e65100; }
    .alert-cancelled { background: #f5f5f5; border-left: 4px solid #424242; }
    .alert-cancelled h3 { margin: 0 0 15px 0; color: #424242; }
    
    .cancel-reason { margin-top: 15px; }
    .cancel-reason label { font-size: 12px; color: #666; display: block; margin-bottom: 5px; }
    .cancel-reason p { background: white; padding: 12px; border-radius: 4px; margin: 0; font-style: italic; border: 1px solid #ddd; }
    
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .info-item label { font-size: 12px; color: #666; display: block; margin-bottom: 3px; }
    .info-item .value { font-weight: bold; font-size: 15px; color: #333; }
    
    .section { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 15px; }
    .section h3 { margin: 0 0 15px 0; color: #333; font-size: 16px; border-left: 4px solid #1976d2; padding-left: 10px; }
    .description label { font-size: 12px; color: #666; display: block; margin-bottom: 5px; }
    .description p { background: white; padding: 12px; border-radius: 4px; margin: 0; border: 1px solid #ddd; }
    
    .history-item { background: #fff3e0; padding: 12px; margin: 8px 0; border-radius: 4px; border-left: 3px solid #ff9800; }
    .history-date { font-weight: bold; margin-bottom: 5px; }
    .history-reason { color: #666; margin-bottom: 5px; }
    .history-by { font-size: 12px; color: #999; }
    
    .actions { margin-top: 25px; display: flex; gap: 10px; flex-wrap: wrap; padding-top: 20px; border-top: 2px solid #f0f0f0; }
    .actions button { padding: 12px 20px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
    .actions button:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
    .btn-actual { background: #4caf50; color: white; }
    .btn-reschedule { background: #ff9800; color: white; }
    .btn-cancel-action { background: #f44336; color: white; }
    .btn-approve { background: #2196f3; color: white; }
    
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; }
    .modal-content h3 { margin: 0 0 20px 0; color: #333; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
    .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 14px; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #1976d2; }
    .form-row { display: flex; gap: 15px; }
    .form-row .form-group { flex: 1; }
    .error-message { color: #f44336; font-size: 12px; margin-top: 5px; }
    
    .warning-box { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin-bottom: 20px; border-radius: 4px; color: #e65100; font-weight: bold; }
    
    .quick-reasons { margin-bottom: 20px; }
    .quick-reasons label { display: block; margin-bottom: 10px; font-size: 13px; color: #666; font-weight: bold; }
    .reason-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .reason-buttons button { padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 20px; cursor: pointer; font-size: 12px; transition: all 0.2s; }
    .reason-buttons button:hover { background: #f44336; color: white; border-color: #f44336; }
    
    .modal-actions { display: flex; gap: 10px; margin-top: 25px; }
    .modal-actions button { flex: 1; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; }
    .btn-submit { background: #4caf50; color: white; }
    .btn-confirm-cancel { background: #f44336; color: white; }
    .btn-confirm-cancel:disabled { background: #ccc; cursor: not-allowed; }
    .btn-cancel-modal { background: #f5f5f5; color: #333; }
    .btn-submit:hover, .btn-confirm-cancel:hover:not(:disabled), .btn-cancel-modal:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    
    @media (max-width: 768px) {
      .actions { flex-direction: column; }
      .actions button { width: 100%; }
      .form-row { flex-direction: column; }
      .reason-buttons { flex-direction: column; }
      .reason-buttons button { width: 100%; }
    }
  `]
})
export class WorkOrderDetailComponent implements OnInit {
  order: WorkOrder | null = null;
  showActualForm = false;
  showRescheduleForm = false;
  showCancelForm = false;
  actualForm: FormGroup;
  rescheduleForm: FormGroup;
  cancelForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workOrderService: WorkOrderService,
    public auth: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.actualForm = this.fb.group({
      actualDate: ['', Validators.required],
      actualStartTime: [''],
      actualEndTime: [''],
      actualLocation: [''],
      actualDescription: ['', Validators.required]
    });

    this.rescheduleForm = this.fb.group({
      newDate: ['', Validators.required],
      reason: ['', Validators.required]
    });

    this.cancelForm = this.fb.group({
      cancelReason: ['', Validators.required]
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOrder(id);
    }
  }

  loadOrder(id: string) {
    this.workOrderService.getOrderById(id).subscribe({
      next: (order) => {
        this.order = order;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error('ไม่สามารถโหลดข้อมูลงานได้');
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  get canUpdateActual(): boolean {
    if (!this.order) return false;
    const isOwner = this.order.technician?._id === this.auth.currentUser?._id;
    return isOwner && this.order.status === 'approved';
  }

  get canReschedule(): boolean {
    if (!this.order) return false;
    const isOwner = this.order.technician?._id === this.auth.currentUser?._id;
    return isOwner && ['approved', 'pending_approval'].includes(this.order.status);
  }

  get canCancel(): boolean {
    if (!this.order) return false;
    const isOwner = this.order.technician?._id === this.auth.currentUser?._id;
    const isSupervisor = this.auth.isSupervisor;
    const cancellableStatuses = ['draft', 'pending_approval', 'approved', 'overdue', 'in_progress'];
    return (isOwner || isSupervisor) && cancellableStatuses.includes(this.order.status);
  }

  get canApprove(): boolean {
    return this.auth.isSupervisor && this.order?.status === 'pending_approval';
  }

  getStatusText(status: string): string {
    const map: any = {
      'draft': '📝 ร่าง',
      'pending_approval': '⏳ รออนุมัติ',
      'approved': '✅ อนุมัติแล้ว',
      'in_progress': '🔧 กำลังดำเนินการ',
      'completed': '✅ เสร็จสิ้น',
      'overdue': '⚠️ ค้างเกินกำหนด',
      'cancelled': ' ยกเลิกแล้ว',
      'rescheduled': '🔄 เลื่อนแล้ว'
    };
    return map[status] || status;
  }

  setQuickReason(reason: string): void {
    this.cancelForm.patchValue({ cancelReason: reason });
  }

  submitActual() {
    if (this.actualForm.invalid) {
      this.toastr.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
      this.actualForm.markAllAsTouched();
      return;
    }
    
    this.workOrderService.updateActual(this.order!._id, this.actualForm.value).subscribe({
      next: (res) => {
        this.toastr.success('บันทึกงานจริงสำเร็จ');
        this.order = res;
        this.showActualForm = false;
        this.actualForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => this.toastr.error(err.error?.message || 'เกิดข้อผิดพลาด')
    });
  }

  submitReschedule() {
    if (this.rescheduleForm.invalid) {
      this.toastr.warning('กรุณากรอกข้อมูลให้ครบถ้วน');
      this.rescheduleForm.markAllAsTouched();
      return;
    }
    
    this.workOrderService.reschedule(
      this.order!._id, 
      this.rescheduleForm.value.newDate, 
      this.rescheduleForm.value.reason
    ).subscribe({
      next: (res) => {
        this.toastr.success('เลื่อนงานสำเร็จ รออนุมัติ');
        this.order = res;
        this.showRescheduleForm = false;
        this.rescheduleForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => this.toastr.error(err.error?.message || 'เกิดข้อผิดพลาด')
    });
  }

  submitCancel() {
    if (this.cancelForm.invalid) {
      this.toastr.warning('กรุณาระบุเหตุผลการยกเลิก');
      this.cancelForm.markAllAsTouched();
      return;
    }
    
    const confirmMsg = `ยืนยันการยกเลิกงาน ${this.order?.srNumber}?\n\nเหตุผล: ${this.cancelForm.value.cancelReason}\n\n⚠️ การดำเนินการนี้ไม่สามารถย้อนกลับได้`;
    if (!confirm(confirmMsg)) return;
    
    this.workOrderService.cancel(
      this.order!._id, 
      this.cancelForm.value.cancelReason
    ).subscribe({
      next: (res: any) => {
        this.toastr.success('ยกเลิกงานสำเร็จ');
        this.order = res.order;
        this.showCancelForm = false;
        this.cancelForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'เกิดข้อผิดพลาด');
      }
    });
  }

  approve() {
    if (confirm('ยืนยันการอนุมัติแผนงานนี้?')) {
      this.workOrderService.approve(this.order!._id).subscribe({
        next: (res) => {
          this.toastr.success('อนุมัติสำเร็จ');
          this.order = res;
          this.cdr.detectChanges();
        },
        error: (err) => this.toastr.error(err.error?.message || 'เกิดข้อผิดพลาด')
      });
    }
  }

  back() {
    this.router.navigate(['/calendar']);
  }
}
