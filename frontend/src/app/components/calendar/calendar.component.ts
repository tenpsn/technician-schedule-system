import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WorkOrderService, WorkOrder } from '../../services/work-order.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import * as moment from 'moment';

@Component({
  selector: 'app-calendar',
  standalone: false,
  template: `
    <div class="calendar-container">
      <div class="header">
        <div>
          <h2>📅 ตารางงาน - {{ currentMonth | date:'MMMM yyyy' }}</h2>
          <p *ngIf="auth.currentUser">ผู้ใช้งาน: {{ auth.currentUser.fullName }}</p>
        </div>
        <div class="controls">
          <select [(ngModel)]="selectedMonth" (change)="onMonthYearChange()" class="select-month">
            <option *ngFor="let m of months" [value]="m.value">{{ m.label }}</option>
          </select>
          <select [(ngModel)]="selectedYear" (change)="onMonthYearChange()" class="select-year">
            <option *ngFor="let y of years" [value]="y">{{ y }}</option>
          </select>
          <button (click)="changeMonth(-1)" class="btn-nav">◀ ก่อนหน้า</button>
          <button (click)="changeMonth(0)" class="btn-nav">วันนี้</button>
          <button (click)="changeMonth(1)" class="btn-nav">ถัดไป ▶</button>
          <button *ngIf="auth.isSupervisor" (click)="toggleView()" class="btn-view">
            {{ showAll ? '👤 งานของฉัน' : '👥 งานทั้งหมด' }}
          </button>
          <button (click)="addNewWork()" class="btn-add">➕ เพิ่มงาน</button>
        </div>
      </div>

      <!-- Overdue Alert -->
      <div *ngIf="overdueOrders.length > 0" class="alert-box alert-danger">
        <h3>️ งานค้างเกินกำหนด ({{ overdueOrders.length }} รายการ)</h3>
        <div *ngFor="let order of overdueOrders" class="overdue-item">
          <strong>{{ order.srNumber }}</strong> - {{ order.customerName }}
          <span class="days">ค้าง {{ order.overdueDays }} วัน</span>
          <button (click)="viewOrder(order._id)" class="btn-small">ดูรายละเอียด</button>
        </div>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-grid">
        <div class="day-header" *ngFor="let day of weekDays">{{ day }}</div>
        <div *ngFor="let day of calendarDays" 
             class="day-cell" 
             [class.other-month]="!day.isCurrentMonth"
             [class.today]="day.isToday"
             (click)="onDayClick(day)">
          <div class="date-number">{{ day.date | date:'d' }}</div>
          <div *ngFor="let order of day.orders" 
               class="work-item"
               [class.planning]="order.status === 'approved' || order.status === 'pending_approval'"
               [class.actual]="order.status === 'completed'"
               [class.overdue]="order.isOverdue"
               [class.cancelled]="order.status === 'cancelled'"
               (click)="viewOrder(order._id); $event.stopPropagation()">
            <div class="sr-num">{{ order.srNumber }}</div>
            <div class="customer">{{ order.customerName }}</div>
            <div class="type">{{ order.workType }}</div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <span class="legend-item planning">📋 Planning</span>
        <span class="legend-item actual">✅ Actual</span>
        <span class="legend-item overdue">⚠️ Overdue</span>
        <span class="legend-item cancelled">🚫 Cancelled</span>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container { padding: 20px; max-width: 1400px; margin: 0 auto; }
    .header { 
      display: flex; justify-content: space-between; align-items: center; 
      margin-bottom: 20px; flex-wrap: wrap; gap: 15px;
    }
    .header h2 { margin: 0 0 5px 0; color: #1976d2; }
    .header p { margin: 0; color: #666; font-size: 14px; }
    .controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .select-month, .select-year {
      padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px;
      font-size: 14px; background: white; cursor: pointer;
    }
    .btn-nav, .btn-view, .btn-add {
      padding: 8px 16px; border: none; border-radius: 4px;
      cursor: pointer; font-weight: bold; transition: all 0.2s;
    }
    .btn-nav { background: #f5f5f5; color: #333; }
    .btn-nav:hover { background: #e0e0e0; }
    .btn-view { background: #2196f3; color: white; }
    .btn-add { background: #4caf50; color: white; }
    
    .alert-box { 
      background: #ffebee; border-left: 4px solid #f44336; 
      padding: 15px; margin-bottom: 20px; border-radius: 4px;
    }
    .alert-box h3 { margin: 0 0 10px 0; color: #c62828; }
    .overdue-item { 
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px; margin: 5px 0; background: white; border-radius: 4px;
    }
    .days { color: #f44336; font-weight: bold; margin: 0 10px; }
    .btn-small { 
      padding: 4px 12px; border: none; border-radius: 4px; 
      background: #f44336; color: white; cursor: pointer; font-size: 12px;
    }
    
    .calendar-grid { 
      display: grid; 
      grid-template-columns: repeat(7, 1fr); 
      gap: 2px; 
      background: #e0e0e0;
      border: 1px solid #e0e0e0;
      border-radius: 4px; overflow: hidden;
    }
    .day-header { 
      background: #1976d2; color: white; padding: 12px; 
      text-align: center; font-weight: bold;
    }
    .day-cell { 
      background: white; min-height: 120px; padding: 5px; 
      position: relative; cursor: pointer;
    }
    .day-cell:hover { background: #f5f5f5; }
    .day-cell.other-month { background: #fafafa; color: #999; }
    .day-cell.today { background: #fff9c4; }
    .date-number { font-weight: bold; margin-bottom: 5px; font-size: 14px; }
    
    .work-item { 
      padding: 4px; margin: 2px 0; border-radius: 3px; 
      cursor: pointer; font-size: 11px; transition: all 0.2s;
    }
    .work-item:hover { transform: scale(1.02); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .work-item.planning { background: #e3f2fd; border-left: 3px solid #2196f3; }
    .work-item.actual { background: #e8f5e9; border-left: 3px solid #4caf50; }
    .work-item.overdue { background: #ffebee; border-left: 3px solid #f44336; }
    .work-item.cancelled { background: #f5f5f5; border-left: 3px solid #9e9e9e; text-decoration: line-through; }
    
    .sr-num { font-weight: bold; font-size: 10px; }
    .customer { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .type { font-size: 9px; color: #666; }
    
    .legend { margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap; }
    .legend-item { padding: 5px 12px; border-radius: 3px; font-size: 13px; }
    .legend-item.planning { background: #e3f2fd; }
    .legend-item.actual { background: #e8f5e9; }
    .legend-item.overdue { background: #ffebee; }
    .legend-item.cancelled { background: #f5f5f5; }
    
    @media (max-width: 768px) {
      .day-cell { min-height: 80px; }
      .work-item { font-size: 9px; }
      .sr-num, .customer { font-size: 8px; }
      .header { flex-direction: column; align-items: flex-start; }
      .controls { width: 100%; }
      .controls button { flex: 1; }
    }
  `]
})
export class CalendarComponent implements OnInit {
  currentMonth: Date = new Date();
  selectedMonth: number = this.currentMonth.getMonth() + 1;
  selectedYear: number = this.currentMonth.getFullYear();
  weekDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  calendarDays: any[] = [];
  workOrders: WorkOrder[] = [];
  overdueOrders: WorkOrder[] = [];
  showAll = false;
  private ordersSub?: Subscription;

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
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadCalendar();
  }

  onMonthYearChange() {
    this.currentMonth = new Date(this.selectedYear, this.selectedMonth - 1, 1);
    this.loadCalendar();
  }

  loadCalendar() {
    const month = this.currentMonth.getMonth() + 1;
    const year = this.currentMonth.getFullYear();
    
    const obs = this.showAll && this.auth.isSupervisor
      ? this.workOrderService.getAllOrders(month, year)
      : this.workOrderService.getMyOrders(month, year);

    this.ordersSub?.unsubscribe();
    this.ordersSub = obs.subscribe({
      next: (orders) => {
        this.workOrders = orders;
        this.buildCalendarDays();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading orders:', err)
    });

    if (this.auth.isSupervisor) {
      this.workOrderService.getOverdue().subscribe({
        next: (orders) => {
          this.overdueOrders = orders;
          this.cdr.detectChanges();
        },
        error: (err) => console.error('Error loading overdue:', err)
      });
    }
  }

  buildCalendarDays() {
    this.calendarDays = [];
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const today = new Date();

    // Previous month days
    const prevMonthLast = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast.getDate() - i);
      this.calendarDays.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        orders: this.getOrdersForDate(d)
      });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      this.calendarDays.push({
        date: d,
        isCurrentMonth: true,
        isToday: this.isSameDay(d, today),
        orders: this.getOrdersForDate(d)
      });
    }

    // Next month days
    const remaining = 42 - this.calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      this.calendarDays.push({
        date: d,
        isCurrentMonth: false,
        isToday: false,
        orders: this.getOrdersForDate(d)
      });
    }
  }

  getOrdersForDate(date: Date): WorkOrder[] {
    return this.workOrders.filter(order => {
      const planned = new Date(order.plannedDate);
      return this.isSameDay(planned, date);
    });
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  changeMonth(delta: number) {
    if (delta === 0) {
      this.currentMonth = new Date();
    } else {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + delta, 1);
    }
    this.selectedMonth = this.currentMonth.getMonth() + 1;
    this.selectedYear = this.currentMonth.getFullYear();
    this.loadCalendar();
  }

  toggleView() {
    this.showAll = !this.showAll;
    this.loadCalendar();
  }

  onDayClick(day: any) {
    // Optional: Add new work order for this day
    if (day.isCurrentMonth) {
      // Could open a dialog to add new work
      console.log('Clicked on:', day.date);
    }
  }

  viewOrder(id: string) {
    this.router.navigate(['/work-orders', id]);
  }

  addNewWork() {
    this.router.navigate(['/work-orders/new']);
  }
}
