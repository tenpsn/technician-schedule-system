import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { WorkOrderService, WorkOrder } from '../../services/work-order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cancelled-orders',
  standalone: false,
  template: `
    <div class="container">
      <div class="header">
        <h2> รายงานงานที่ยกเลิก</h2>
        <button (click)="back()" class="btn-back">← กลับ</button>
      </div>
      
      <div class="filters">
        <div class="filter-group">
          <label>เดือน:</label>
          <select [(ngModel)]="selectedMonth" (change)="loadData()">
            <option *ngFor="let m of months" [value]="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>ปี:</label>
          <select [(ngModel)]="selectedYear" (change)="loadData()">
            <option *ngFor="let y of years" [value]="y">{{ y }}</option>
          </select>
        </div>
      </div>

      <div *ngIf="loading" class="loading">
        <div class="spinner"></div>
        กำลังโหลด...
      </div>
      
      <div *ngIf="!loading && orders.length === 0" class="empty">
        📭 ไม่พบงานที่ยกเลิกในเดือนที่เลือก
      </div>

      <div *ngIf="!loading && orders.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>SR Number</th>
              <th>ลูกค้า</th>
              <th>ประเภท</th>
              <th>ช่าง</th>
              <th>วันที่วางแผน</th>
              <th>ผู้ยกเลิก</th>
              <th>เวลายกเลิก</th>
              <th>เหตุผล</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let order of orders">
              <td><strong>{{ order.srNumber }}</strong></td>
              <td>{{ order.customerName }}</td>
              <td><span class="badge">{{ order.workType }}</span></td>
              <td>{{ order.technician?.fullName }}</td>
              <td>{{ order.plannedDate | date:'dd/MM/yyyy' }}</td>
              <td>{{ order.cancelledBy?.fullName }}</td>
              <td>{{ order.cancelledAt | date:'dd/MM/yyyy HH:mm' }}</td>
              <td class="reason-cell">{{ order.cancelReason }}</td>
            </tr>
          </tbody>
        </table>

        <div class="summary">
          <strong>📊 สรุป:</strong> พบงานที่ยกเลิกทั้งหมด {{ orders.length }} รายการ
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 1200px; margin: 20px auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0; }
    .header h2 { margin: 0; color: #1976d2; }
    .btn-back { padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; }
    .btn-back:hover { background: #f5f5f5; }
    
    .filters { display: flex; gap: 20px; margin-bottom: 25px; flex-wrap: wrap; padding: 15px; background: #f9f9f9; border-radius: 6px; }
    .filter-group { display: flex; align-items: center; gap: 10px; }
    .filter-group label { font-weight: bold; color: #555; }
    .filter-group select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    
    .data-table { width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .data-table th, .data-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    .data-table th { background: #1976d2; color: white; font-weight: bold; }
    .data-table tr:hover { background: #f5f5f5; }
    .data-table tr:last-child td { border-bottom: none; }
    .reason-cell { max-width: 300px; font-style: italic; color: #666; font-size: 13px; }
    .badge { display: inline-block; padding: 4px 8px; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 12px; font-weight: bold; }
    
    .summary { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px; text-align: right; font-size: 15px; }
    .loading, .empty { text-align: center; padding: 60px 20px; color: #666; font-size: 16px; }
    .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #1976d2; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    @media (max-width: 768px) {
      .data-table { font-size: 12px; }
      .data-table th, .data-table td { padding: 8px 6px; }
      .reason-cell { max-width: 150px; }
      .filters { flex-direction: column; }
    }
  `]
})
export class CancelledOrdersComponent implements OnInit {
  orders: WorkOrder[] = [];
  loading = false;
  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();
  
  months = [
    { value: 1, label: 'มกราคม' }, { value: 2, label: 'กุมภาพันธ์' },
    { value: 3, label: 'มีนาคม' }, { value: 4, label: 'เมษายน' },
    { value: 5, label: 'พฤษภาคม' }, { value: 6, label: 'มิถุนายน' },
    { value: 7, label: 'กรกฎาคม' }, { value: 8, label: 'สิงหาคม' },
    { value: 9, label: 'กันยายน' }, { value: 10, label: 'ตุลาคม' },
    { value: 11, label: 'พฤศจิกายน' }, { value: 12, label: 'ธันวาคม' }
  ];
  years = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i);

  constructor(
    private workOrderService: WorkOrderService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.workOrderService.getCancelledOrders(this.selectedMonth, this.selectedYear)
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading cancelled orders:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  back() {
    window.history.back();
  }
}
