import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { WorkOrderService, WorkOrder } from '../../services/work-order.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-cancelled-orders',
  standalone: false,
  template: `
    <div class="page">
      <div class="card">
        <div class="card-head">
          <div class="head-title">{{ i18n.t['cancelReport'] }}</div>
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <div class="filter-bar">
          <span class="muted">{{ i18n.t['month'] }}</span>
          <app-select class="month-select" [ngModel]="selectedMonth" (ngModelChange)="selectedMonth = $event; loadData()" [options]="months"></app-select>
          <span class="muted">{{ i18n.t['year'] }}</span>
          <app-select class="year-select" [ngModel]="selectedYear" (ngModelChange)="selectedYear = $event; loadData()" [options]="yearOptions"></app-select>
        </div>

        <div class="search-bar" *ngIf="!loading">
          <div class="search-box">
            <span>⌕</span>
            <input type="text" [(ngModel)]="searchText" [placeholder]="i18n.t['searchList']">
          </div>
          <span class="mono count">{{ i18n.t['allOf'] }} {{ filteredOrders.length }} / {{ orders.length }}</span>
        </div>

        <div *ngIf="loading" class="empty-state">{{ i18n.t['loading'] }}</div>
        <div *ngIf="!loading && orders.length === 0" class="empty-state">{{ i18n.t['noResults'] }}</div>

        <div *ngIf="!loading && orders.length > 0" class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ i18n.t['colSr'] }}</th>
                <th>{{ i18n.t['colHospital'] }}</th>
                <th>{{ i18n.t['colType'] }}</th>
                <th>{{ i18n.t['colTech'] }}</th>
                <th>{{ i18n.t['colPlan'] }}</th>
                <th>{{ i18n.t['colBy'] }}</th>
                <th>{{ i18n.t['colAt'] }}</th>
                <th>{{ i18n.t['colReason'] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let order of filteredOrders">
                <td class="mono">{{ order.srNumber }}</td>
                <td>{{ order.customerName }}</td>
                <td><span class="badge">{{ i18n.typeLabel(order.workType) }}</span></td>
                <td>{{ order.technician?.fullName }}</td>
                <td class="mono">{{ order.plannedDate | date:'dd/MM/yyyy' }}</td>
                <td>{{ order.cancelledBy?.fullName }}</td>
                <td class="mono">{{ order.cancelledAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="reason-cell">{{ order.cancelReason }}</td>
              </tr>
              <tr *ngIf="filteredOrders.length === 0">
                <td colspan="8" class="empty-cell">{{ i18n.t['noResults'] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 1200px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .filter-bar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: var(--alt); border-bottom: 1px solid var(--line2); flex-wrap: wrap; }
    .muted { font-size: 13px; color: var(--sub); }
    .filter-bar app-select.month-select { flex: 0 0 180px; }
    .filter-bar app-select.year-select { flex: 0 0 110px; }
    .spacer { flex: 1; }

    .search-bar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--line2); flex-wrap: wrap; }
    .search-box { border-radius: var(--radius); flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); }
    .search-box span { color: var(--sub); font-size: 13px; }
    .search-box input { border: none; background: transparent; outline: none; font-size: 13.5px; width: 100%; color: var(--ink); }
    .count { font-size: 12.5px; color: var(--sub); }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--sub); font-size: 15px; }
    .empty-cell { text-align: center; color: var(--sub); padding: 30px; }

    .table-scroll { overflow-x: auto; }
    .data-table { width: 100%; min-width: 900px; border-collapse: collapse; }
    .data-table th { background: var(--alt); color: var(--sub); border-bottom: 2px solid var(--accent); text-align: left; padding: 11px 14px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }
    .data-table td { padding: 12px 14px; border-bottom: 1px solid var(--line2); font-size: 13px; }
    .reason-cell { max-width: 260px; color: var(--sub); font-size: 12.5px; }
    .badge { display: inline-block; padding: 2px 8px; background: var(--info-bg); color: var(--info-text); border: 1px solid var(--info-line); border-radius: var(--radius); font-size: 11.5px; font-weight: 600; }

    @media (max-width: 768px) {
      .reason-cell { max-width: 150px; }
      .filter-bar { flex-direction: column; align-items: stretch; }
      .filter-bar app-select.month-select, .filter-bar app-select.year-select { flex: 1 1 auto; }
    }
  `]
})
export class CancelledOrdersComponent implements OnInit {
  orders: WorkOrder[] = [];
  loading = false;
  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();
  searchText = '';

  years = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i);

  get months() {
    const locale = this.i18n.lang === 'th' ? 'th-TH' : 'en-US';
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' })
    }));
  }

  get yearOptions() {
    return this.years.map(y => ({ value: y, label: String(y) }));
  }

  constructor(
    private workOrderService: WorkOrderService,
    public auth: AuthService,
    public i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  get filteredOrders(): WorkOrder[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.orders;
    return this.orders.filter(o =>
      (o.srNumber || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.technician?.fullName || '').toLowerCase().includes(q) ||
      (o.cancelledBy?.fullName || '').toLowerCase().includes(q) ||
      (o.cancelReason || '').toLowerCase().includes(q) ||
      this.i18n.typeLabel(o.workType).toLowerCase().includes(q)
    );
  }

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
