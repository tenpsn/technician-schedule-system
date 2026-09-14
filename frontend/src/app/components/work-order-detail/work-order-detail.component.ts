import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkOrderService, WorkOrder } from '../../services/work-order.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

const REASON_KEYS_TH = ['ลูกค้าขอยกเลิกเนื่องจากเปลี่ยนผู้ให้บริการ', 'อุปกรณ์/อะไหล่ไม่พร้อม', 'ติดงานอื่นที่เร่งด่วนกว่า', 'สภาพอากาศไม่เอื้ออำนวย', 'ลูกค้าเลื่อนออกไปไม่มีกำหนด', 'อื่นๆ (ระบุเอง)'];
const REASON_LABELS_TH = ['ลูกค้าขอยกเลิก', 'อุปกรณ์ไม่พร้อม', 'ติดงานเร่งด่วน', 'สภาพอากาศ', 'ลูกค้าเลื่อนไม่มีกำหนด', 'อื่นๆ'];
const REASON_KEYS_EN = ['Customer requested cancellation (switched provider)', 'Parts/equipment not ready', 'Higher-priority job conflict', 'Weather', 'Customer postponed indefinitely', 'Other (specify)'];
const REASON_LABELS_EN = ['Customer cancelled', 'Parts not ready', 'Urgent job conflict', 'Weather', 'Postponed indefinitely', 'Other'];

type Busy = 'approve' | 'approve-done' | 'cancel' | 'cancel-done' | 'postpone' | 'postpone-done' | 'actual' | 'actual-done' | null;

@Component({
  selector: 'app-work-order-detail',
  standalone: false,
  template: `
    <div class="page" *ngIf="order">
      <div class="card">
        <div class="card-head">
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
          <div class="head-title">{{ i18n.t['jobDetail'] }}: <span class="mono">{{ order.srNumber }}</span></div>
          <div class="spacer"></div>
          <span class="badge" [ngClass]="statusClass(order.status)">{{ i18n.statusLabel(order.status) }}</span>
        </div>

        <div class="card-body">
          <div class="alert-warn" *ngIf="order.isOverdue">
            ⚠ {{ i18n.t['overdueAlert'] }}: {{ order.overdueDays }} {{ i18n.t['overdueDaysSuffix'] }}
          </div>

          <div class="alert-muted" *ngIf="order.status === 'cancelled'">
            <div class="alert-title">✕ {{ i18n.t['cancelledInfo'] }}</div>
            <div class="meta-grid">
              <div class="meta-item"><div class="meta-label">{{ i18n.t['cancelledBy'] }}</div><div class="meta-value">{{ order.cancelledBy?.fullName }}</div></div>
              <div class="meta-item"><div class="meta-label">{{ i18n.t['cancelledAt'] }}</div><div class="meta-value">{{ order.cancelledAt | date:'dd/MM/yyyy HH:mm' }}</div></div>
            </div>
            <div class="reason-box">
              <div class="meta-label">{{ i18n.t['cancelReason'] }}</div>
              <p>{{ order.cancelReason }}</p>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><div class="meta-label">{{ i18n.t['customer'] }}</div><div class="meta-value">{{ order.customerName }}</div></div>
            <div class="meta-item"><div class="meta-label">{{ i18n.t['site'] }}</div><div class="meta-value">{{ order.customerLocation }}</div></div>
            <div class="meta-item"><div class="meta-label">{{ i18n.t['jobType'] }}</div><div class="meta-value">{{ i18n.typeLabel(order.workType) }}</div></div>
            <div class="meta-item"><div class="meta-label">{{ i18n.t['owner'] }}</div><div class="meta-value">{{ order.technician?.fullName }}</div></div>
          </div>

          <div class="section">
            <div class="section-title">{{ i18n.t['planning'] }}</div>
            <div class="meta-grid">
              <div class="meta-item"><div class="meta-label">{{ i18n.t['planDate'] }}</div><div class="meta-value mono">{{ order.plannedDate | date:'dd/MM/yyyy' }}</div></div>
              <div class="meta-item"><div class="meta-label">{{ i18n.t['timeLabel'] }}</div><div class="meta-value mono">{{ order.plannedStartTime }} - {{ order.plannedEndTime }}</div></div>
            </div>
            <div class="field-list" *ngIf="order.description">
              <div class="field-row"><span class="field-label">{{ i18n.t['jobDesc'] }}</span><span class="field-value">{{ order.description }}</span></div>
            </div>
          </div>

          <div class="section" *ngIf="order.actualDescription">
            <div class="section-title">✓ Actual</div>
            <div class="meta-grid">
              <div class="meta-item"><div class="meta-label">{{ i18n.t['actualDate'] }}</div><div class="meta-value mono">{{ order.actualDate | date:'dd/MM/yyyy' }}</div></div>
              <div class="meta-item"><div class="meta-label">{{ i18n.t['timeLabel'] }}</div><div class="meta-value mono">{{ order.actualStartTime }} - {{ order.actualEndTime }}</div></div>
              <div class="meta-item"><div class="meta-label">{{ i18n.t['actualLocation'] }}</div><div class="meta-value">{{ order.actualLocation }}</div></div>
            </div>
            <div class="field-list">
              <div class="field-row"><span class="field-label">{{ i18n.t['actualDescription'] }}</span><span class="field-value">{{ order.actualDescription }}</span></div>
            </div>
          </div>

          <div class="section" *ngIf="order.rescheduleHistory && order.rescheduleHistory.length > 0">
            <div class="section-title">↻ {{ i18n.t['rescheduleHistory'] }}</div>
            <div class="history-item" *ngFor="let h of order.rescheduleHistory">
              <div class="history-date mono">{{ h.fromDate | date:'dd/MM/yyyy' }} → {{ h.toDate | date:'dd/MM/yyyy' }}</div>
              <div class="history-reason">{{ i18n.t['reasonWord'] }}: {{ h.reason }}</div>
              <div class="history-by">{{ i18n.t['byWord'] }}: {{ h.changedBy?.fullName || '—' }} · {{ h.changedAt | date:'dd/MM/yyyy HH:mm' }}</div>
            </div>
          </div>
        </div>

        <div class="actions" *ngIf="order.status !== 'cancelled' && order.status !== 'completed'">
          <button *ngIf="canReschedule" (click)="showRescheduleForm = true" class="btn-postpone">{{ i18n.t['postpone'] }}</button>
          <button *ngIf="canCancel" (click)="openCancel()" class="btn-cancel">{{ i18n.t['cancelJob'] }}</button>
          <button *ngIf="canApprove" (click)="showApproveModal = true" class="btn-approve">{{ i18n.t['approvePlan'] }}</button>
          <button *ngIf="canUpdateActual" (click)="showActualForm = true" class="btn-update">{{ i18n.t['updateStatus'] }}</button>
        </div>
      </div>

      <!-- Cancel modal (two-stage: edit reason -> review & confirm) -->
      <div *ngIf="showCancelForm" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-icon-row">
            <span class="modal-icon st-danger">✕</span>
            <div>
              <div class="modal-title">{{ i18n.t['cancelJob'] }}</div>
              <div class="modal-sub mono">{{ order.srNumber }} · {{ order.customerName }}</div>
            </div>
          </div>

          <ng-container *ngIf="cancelStage === 'edit'">
            <div class="warn-box">⚠ {{ i18n.t['cancelWarn'] }}</div>
            <form [formGroup]="cancelForm" (ngSubmit)="goConfirmCancelStage()">
              <label class="field">
                <span>{{ i18n.t['cancelReason'] }} *</span>
                <textarea formControlName="cancelReason" rows="4" [placeholder]="i18n.t['cancelReasonPh']"></textarea>
              </label>
              <div class="mono kicker">{{ i18n.t['commonReasons'] }}</div>
              <div class="chip-row">
                <button type="button" *ngFor="let r of reasonChips" class="chip" (click)="setQuickReason(r.value)">{{ r.label }}</button>
              </div>
              <div class="modal-actions">
                <button type="submit" class="btn-cancel">{{ i18n.t['confirmCancel'] }}</button>
                <button type="button" (click)="closeCancelModal()" class="btn-ghost">{{ i18n.t['back'] }}</button>
              </div>
            </form>
          </ng-container>

          <ng-container *ngIf="cancelStage === 'confirm'">
            <div class="review-box st-danger-bg">
              <div class="mono kicker-strong">{{ i18n.t['confirmStep'] }}</div>
              <div class="review-title">{{ i18n.t['confirmCancelQ'] }} {{ order.srNumber }}</div>
              <div class="review-line">{{ i18n.t['reasonWord'] }}: {{ cancelForm.value.cancelReason }}</div>
              <div class="review-warn">⚠ {{ i18n.t['irreversible'] }}</div>
            </div>
            <div class="modal-actions">
              <button type="button" [disabled]="busy === 'cancel'" (click)="confirmCancel()" class="btn-cancel">{{ confirmCancelLabel }}</button>
              <button type="button" [disabled]="busy === 'cancel'" (click)="backToEditCancel()" class="btn-ghost">{{ i18n.t['reviewEdit'] }}</button>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Approve modal -->
      <div *ngIf="showApproveModal" class="modal-overlay">
        <div class="modal-card modal-card-narrow">
          <div class="modal-icon-row">
            <span class="modal-icon st-info">✓</span>
            <div class="modal-title">{{ i18n.t['approveTitle'] }}</div>
          </div>
          <div class="modal-body-text">{{ i18n.t['approveBody'] }}</div>
          <div class="summary-box">
            <div class="mono kicker">{{ order.srNumber }}</div>
            <div class="review-title">{{ order.customerName }}</div>
            <div class="summary-sub">{{ i18n.typeLabel(order.workType) }} · {{ order.plannedDate | date:'dd/MM/yyyy' }} · {{ order.plannedStartTime }}-{{ order.plannedEndTime }}</div>
          </div>
          <div class="modal-actions">
            <button type="button" [disabled]="busy === 'approve'" (click)="confirmApprove()" class="btn-approve">{{ approveConfirmLabel }}</button>
            <button type="button" [disabled]="busy === 'approve'" (click)="showApproveModal = false" class="btn-ghost">{{ i18n.t['cancel'] }}</button>
          </div>
        </div>
      </div>

      <!-- Postpone (reschedule) modal -->
      <div *ngIf="showRescheduleForm" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-title">{{ i18n.t['postpone'] }}</div>
          <form [formGroup]="rescheduleForm" (ngSubmit)="submitReschedule()">
            <label class="field">
              <span>{{ i18n.t['newDate'] }} *</span>
              <app-date-picker formControlName="newDate"></app-date-picker>
            </label>
            <label class="field">
              <span>{{ i18n.t['postponeReason'] }} *</span>
              <textarea formControlName="reason" rows="4" [placeholder]="i18n.t['postponeReasonPh']"></textarea>
            </label>
            <div class="modal-actions">
              <button type="submit" [disabled]="busy === 'postpone'" class="btn-update">{{ confirmPostponeLabel }}</button>
              <button type="button" [disabled]="busy === 'postpone'" (click)="showRescheduleForm = false" class="btn-ghost">{{ i18n.t['cancel'] }}</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Actual work modal -->
      <div *ngIf="showActualForm" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-title">{{ i18n.t['updateStatus'] }}</div>
          <form [formGroup]="actualForm" (ngSubmit)="submitActual()">
            <label class="field">
              <span>{{ i18n.t['actualDate'] }} *</span>
              <app-date-picker formControlName="actualDate"></app-date-picker>
            </label>
            <div class="field-row-pair">
              <label class="field"><span>{{ i18n.t['startTime'] }}</span><app-time-picker formControlName="actualStartTime"></app-time-picker></label>
              <label class="field"><span>{{ i18n.t['endTime'] }}</span><app-time-picker formControlName="actualEndTime"></app-time-picker></label>
            </div>
            <label class="field">
              <span>{{ i18n.t['actualLocation'] }}</span>
              <input formControlName="actualLocation" type="text">
            </label>
            <label class="field">
              <span>{{ i18n.t['actualDescription'] }} *</span>
              <textarea formControlName="actualDescription" rows="4"></textarea>
            </label>
            <div class="modal-actions">
              <button type="submit" [disabled]="busy === 'actual'" class="btn-update">{{ saveActualLabel }}</button>
              <button type="button" [disabled]="busy === 'actual'" (click)="showActualForm = false" class="btn-ghost">{{ i18n.t['cancel'] }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 1040px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--line2); flex-wrap: wrap; }
    .head-title { font-size: 19px; font-weight: 700; }
    .spacer { flex: 1; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .badge { border-radius: var(--radius); font-size: 12px; font-weight: 600; padding: 5px 11px; }
    .st-warn { color: var(--warn-text); background: var(--warn-bg); border: 1px solid var(--warn-line); }
    .st-info { color: var(--info-text); background: var(--info-bg); border: 1px solid var(--info-line); }
    .st-success { color: var(--success-text); background: var(--success-bg); border: 1px solid var(--success-line); }
    .st-neutral { color: var(--sub); background: var(--alt); border: 1px solid var(--line2); }
    .st-danger { color: var(--danger-text); background: var(--danger-bg); border: 1px solid var(--danger-line); }
    .st-muted { color: var(--sub); background: var(--alt); border: 1px solid var(--line2); text-decoration: line-through; }

    .card-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
    .alert-warn { background: var(--warn-bg); border: 1px solid var(--warn-line); color: var(--warn-text); padding: 12px 14px; border-radius: var(--radius); font-weight: 600; }
    .alert-muted { background: var(--alt); border: 1px solid var(--line2); border-radius: var(--radius); padding: 16px 18px; }
    .alert-title { font-weight: 700; margin-bottom: 12px; }
    .reason-box { margin-top: 12px; }
    .reason-box p { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; margin: 6px 0 0; font-style: italic; }

    .meta-grid { display: flex; flex-wrap: wrap; gap: 22px; }
    .meta-item { flex: 1 1 180px; min-width: 150px; }
    .meta-label { font-size: 12px; color: var(--sub); }
    .meta-value { font-size: 16px; font-weight: 600; margin-top: 3px; line-height: 1.4; }

    .section { border-radius: var(--radius); background: var(--alt); border: 1px solid var(--line2); padding: 16px 18px; }
    .section-title { font-size: 13.5px; font-weight: 700; padding-left: 10px; border-left: 3px solid var(--accent); }
    .section .meta-grid { margin-top: 14px; }

    .field-list { display: flex; flex-direction: column; margin-top: 12px; }
    .field-row { display: flex; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--line2); }
    .field-label { width: 160px; flex: none; font-size: 12.5px; color: var(--sub); }
    .field-value { font-size: 13.5px; font-weight: 500; }

    .history-item { background: var(--warn-bg); padding: 12px; margin: 8px 0; border-radius: var(--radius); border-left: 3px solid #d98b1e; }
    .history-date { font-weight: 700; margin-bottom: 5px; }
    .history-reason { color: var(--sub); margin-bottom: 5px; }
    .history-by { font-size: 12px; color: var(--sub); }

    .actions { display: flex; flex-wrap: wrap; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--line2); background: var(--alt); }
    .actions button { border-radius: var(--radius); height: 46px; padding: 0 18px; font-size: 14px; font-weight: 700; }
    .btn-postpone { border: 1px solid #b45309; background: #f0b356; color: #3d2703; }
    .btn-cancel { border: 1px solid #a5320c; background: #d94a20; color: #fff; }
    .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-approve { border: 1px solid var(--accent); background: var(--accent); color: #fff; }
    .btn-update { border: 1px solid #0b7a5f; background: #0d8f72; color: #fff; }
    .actions button:hover { filter: brightness(1.05); }

    .modal-overlay {
      position: fixed; inset: 0; z-index: 20; background: rgba(8, 9, 11, 0.62);
      display: flex; align-items: center; justify-content: center; padding: 18px;
      animation: veilIn .16s ease both;
    }
    .modal-card {
      border-radius: 16px; width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; scrollbar-gutter: stable;
      background: var(--surface); border: 1px solid var(--line); padding: 22px;
      animation: modalIn .2s ease both;
    }
    .modal-card-narrow { max-width: 460px; }
    .modal-icon-row { display: flex; align-items: center; gap: 12px; }
    .modal-icon { width: 38px; height: 38px; flex: none; border-radius: 12px; display: grid; place-items: center; font-size: 16px; }
    .modal-title { font-size: 19px; font-weight: 700; }
    .modal-sub { font-size: 11.5px; color: var(--sub); }
    .modal-body-text { font-size: 14px; color: var(--sub); line-height: 1.65; margin-top: 12px; }
    .warn-box { border-radius: var(--radius); display: flex; gap: 10px; margin-top: 14px; padding: 12px 14px; background: var(--warn-bg); border: 1px solid var(--warn-line); color: var(--warn-text); font-weight: 600; font-size: 13.5px; }

    .review-box { border-radius: 12px; margin-top: 16px; padding: 15px; }
    .st-danger-bg { background: var(--danger-bg); border: 1px solid var(--danger-line); }
    .kicker-strong { font-size: 10.5px; letter-spacing: 0.12em; color: var(--danger-text); }
    .review-title { font-size: 15.5px; font-weight: 700; margin-top: 7px; line-height: 1.45; }
    .review-line { font-size: 13.5px; color: var(--ink); line-height: 1.6; margin-top: 8px; }
    .review-warn { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--danger-line); font-size: 12.5px; font-weight: 600; color: var(--danger-text); }

    .summary-box { border-radius: 12px; margin-top: 16px; padding: 13px 14px; background: var(--alt); border: 1px solid var(--line2); }
    .summary-sub { font-size: 13px; color: var(--sub); margin-top: 3px; }

    .field { display: flex; flex-direction: column; gap: 7px; margin-top: 16px; }
    .field span { font-size: 12.5px; color: var(--sub); }
    .field input, .field textarea { border-radius: var(--radius); padding: 11px 12px; border: 1px solid var(--line); background: var(--field); color: var(--ink); font-size: 14px; outline: none; }
    .field input { height: 48px; }
    .field input:focus, .field textarea:focus { border-color: var(--accent); }
    .field-row-pair { display: flex; gap: 15px; margin-top: 14px; }
    .field-row-pair .field { flex: 1; margin-top: 0; }
    .kicker { font-size: 12.5px; color: var(--sub); margin-top: 14px; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; }
    .chip { height: 38px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 19px; font-size: 13px; }
    .chip:hover { border-color: var(--accent); }
    .modal-actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
    .modal-actions button { flex: 1 1 150px; height: 50px; border-radius: var(--radius); font-size: 14.5px; font-weight: 700; }

    @media (max-width: 768px) {
      .actions { flex-direction: column; }
      .actions button { width: 100%; }
      .field-row-pair { flex-direction: column; }
    }
  `]
})
export class WorkOrderDetailComponent implements OnInit {
  order: WorkOrder | null = null;
  showActualForm = false;
  showRescheduleForm = false;
  showCancelForm = false;
  showApproveModal = false;
  cancelStage: 'edit' | 'confirm' = 'edit';
  busy: Busy = null;
  actualForm: FormGroup;
  rescheduleForm: FormGroup;
  cancelForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workOrderService: WorkOrderService,
    public auth: AuthService,
    public i18n: I18nService,
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

  get reasonChips() {
    const keys = this.i18n.lang === 'th' ? REASON_KEYS_TH : REASON_KEYS_EN;
    const labels = this.i18n.lang === 'th' ? REASON_LABELS_TH : REASON_LABELS_EN;
    return keys.map((value, i) => ({ value, label: labels[i] }));
  }

  get approveConfirmLabel(): string {
    if (this.busy === 'approve') return this.i18n.t['approving'];
    if (this.busy === 'approve-done') return this.i18n.t['approvedDone'];
    return this.i18n.t['yesConfirm'];
  }
  get confirmCancelLabel(): string {
    if (this.busy === 'cancel') return this.i18n.t['cancelling'];
    if (this.busy === 'cancel-done') return this.i18n.t['cancelledDone'];
    return this.i18n.t['yesConfirm'];
  }
  get confirmPostponeLabel(): string {
    if (this.busy === 'postpone') return this.i18n.t['postponing'];
    if (this.busy === 'postpone-done') return this.i18n.t['postponedDone'];
    return this.i18n.t['confirmPostpone'];
  }
  get saveActualLabel(): string {
    if (this.busy === 'actual') return this.i18n.t['saving'];
    if (this.busy === 'actual-done') return this.i18n.t['saved'];
    return this.i18n.t['save'];
  }

  loadOrder(id: string) {
    this.workOrderService.getOrderById(id).subscribe({
      next: (order) => {
        this.order = order;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.lang === 'th' ? 'ไม่สามารถโหลดข้อมูลงานได้' : 'Failed to load job');
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'draft':
      case 'pending_approval':
      case 'rescheduled':
        return 'st-warn';
      case 'approved':
        return 'st-info';
      case 'in_progress':
        return 'st-success';
      case 'overdue':
        return 'st-danger';
      case 'cancelled':
        return 'st-muted';
      default:
        return 'st-neutral';
    }
  }

  get canUpdateActual(): boolean {
    if (!this.order) return false;
    const isOwner = this.order.technician?._id === this.auth.currentUser?._id;
    return isOwner && this.order.status === 'approved';
  }

  get canReschedule(): boolean {
    if (!this.order) return false;
    const isOwner = this.order.technician?._id === this.auth.currentUser?._id;
    return (isOwner || this.auth.isAdmin) && ['approved', 'pending_approval'].includes(this.order.status);
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

  setQuickReason(reason: string): void {
    this.cancelForm.patchValue({ cancelReason: reason });
  }

  openCancel() {
    this.cancelStage = 'edit';
    this.showCancelForm = true;
  }

  closeCancelModal() {
    this.showCancelForm = false;
    this.cancelStage = 'edit';
  }

  goConfirmCancelStage() {
    const reason = (this.cancelForm.value.cancelReason || '').trim();
    if (!reason) {
      this.toastr.warning(this.i18n.t['toastNeedReason']);
      this.cancelForm.markAllAsTouched();
      return;
    }
    this.cancelStage = 'confirm';
  }

  backToEditCancel() {
    this.cancelStage = 'edit';
  }

  submitActual() {
    if (this.actualForm.invalid) {
      this.toastr.warning(this.i18n.lang === 'th' ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'Please fill in all required fields');
      this.actualForm.markAllAsTouched();
      return;
    }

    this.busy = 'actual';
    this.workOrderService.updateActual(this.order!._id, this.actualForm.value).subscribe({
      next: (res) => {
        this.order = res;
        this.busy = 'actual-done';
        this.toastr.success(this.i18n.t['toastStatus']);
        this.cdr.detectChanges();
        setTimeout(() => {
          this.busy = null;
          this.showActualForm = false;
          this.actualForm.reset();
          this.cdr.detectChanges();
        }, 700);
      },
      error: (err) => {
        this.busy = null;
        this.toastr.error(err.error?.message || 'Error');
      }
    });
  }

  submitReschedule() {
    if (this.rescheduleForm.invalid) {
      this.toastr.warning(this.i18n.lang === 'th' ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'Please fill in all required fields');
      this.rescheduleForm.markAllAsTouched();
      return;
    }

    this.busy = 'postpone';
    this.workOrderService.reschedule(
      this.order!._id,
      this.rescheduleForm.value.newDate,
      this.rescheduleForm.value.reason
    ).subscribe({
      next: (res) => {
        this.order = res;
        this.busy = 'postpone-done';
        this.toastr.success(this.i18n.t['toastPostponed']);
        this.cdr.detectChanges();
        setTimeout(() => {
          this.busy = null;
          this.showRescheduleForm = false;
          this.rescheduleForm.reset();
          this.cdr.detectChanges();
        }, 700);
      },
      error: (err) => {
        this.busy = null;
        this.toastr.error(err.error?.message || 'Error');
      }
    });
  }

  confirmCancel() {
    this.busy = 'cancel';
    this.workOrderService.cancel(
      this.order!._id,
      this.cancelForm.value.cancelReason
    ).subscribe({
      next: (res: any) => {
        this.order = res.order;
        this.busy = 'cancel-done';
        this.toastr.success(this.i18n.t['toastCancelled']);
        this.cdr.detectChanges();
        setTimeout(() => {
          this.busy = null;
          this.showCancelForm = false;
          this.cancelStage = 'edit';
          this.cancelForm.reset();
          this.cdr.detectChanges();
        }, 700);
      },
      error: (err) => {
        this.busy = null;
        this.toastr.error(err.error?.message || 'Error');
      }
    });
  }

  confirmApprove() {
    this.busy = 'approve';
    this.workOrderService.approve(this.order!._id).subscribe({
      next: (res) => {
        this.order = res;
        this.busy = 'approve-done';
        this.toastr.success(this.i18n.t['toastApproved']);
        this.cdr.detectChanges();
        setTimeout(() => {
          this.busy = null;
          this.showApproveModal = false;
          this.cdr.detectChanges();
        }, 700);
      },
      error: (err) => {
        this.busy = null;
        this.toastr.error(err.error?.message || 'Error');
      }
    });
  }

  back() {
    this.router.navigate(['/calendar']);
  }
}
