import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { WorkOrderService, WorkOrder } from '../../services/work-order.service';
import { UserService } from '../../services/user.service';
import { AuthService, User } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

interface TypeBreakdown {
  type: string;
  count: number;
  pct: number;
  label?: string;
}

@Component({
  selector: 'app-tech-dashboard',
  standalone: false,
  template: `
    <div class="page">
      <div class="layout">
      <div class="card list-card">
        <div class="card-head">
          <div class="head-title">{{ i18n.t['dashboardTitle'] }}</div>
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <div class="filter-bar">
          <div class="period-toggle">
            <button [class.on]="viewMode === 'month'" (click)="setViewMode('month')">{{ i18n.t['viewByMonth'] }}</button>
            <button [class.on]="viewMode === 'year'" (click)="setViewMode('year')">{{ i18n.t['viewByYear'] }}</button>
          </div>
          <span class="muted" *ngIf="viewMode === 'month'">{{ i18n.t['month'] }}</span>
          <app-select class="month-select" *ngIf="viewMode === 'month'" [ngModel]="selectedMonth" (ngModelChange)="selectedMonth = $event; loadData()" [options]="months"></app-select>
          <span class="muted">{{ i18n.t['year'] }}</span>
          <app-select class="year-select" [ngModel]="selectedYear" (ngModelChange)="selectedYear = $event; loadData()" [options]="yearOptions"></app-select>
          <span class="spacer"></span>
          <span class="muted hint" *ngIf="!loading && technicians.length">{{ i18n.t['selectTechHint'] }}</span>
        </div>

        <div class="search-bar" *ngIf="!loading && technicians.length">
          <div class="search-box">
            <span>⌕</span>
            <input type="text" [(ngModel)]="searchText" [placeholder]="i18n.t['searchList']" (ngModelChange)="applyFilter()">
          </div>
          <span class="mono count">{{ i18n.t['allOf'] }} {{ filteredTechnicians.length }} / {{ technicians.length }}</span>
        </div>

        <div *ngIf="loading" class="empty-state">{{ i18n.t['loading'] }}</div>

        <div *ngIf="!loading" class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ i18n.t['team'] }}</th>
                <th>{{ i18n.t['colAssigned'] }}</th>
                <th>{{ i18n.statusLabel('completed') }}</th>
                <th>{{ i18n.statusLabel('cancelled') }}</th>
                <th>{{ i18n.t['colCancelRate'] }}</th>
                <th>{{ i18n.statusLabel('overdue') }}</th>
                <th>{{ i18n.t['colRescheduled'] }}</th>
                <th>{{ i18n.t['colHoursWorked'] }}</th>
                <th>{{ i18n.t['colDaysWorked'] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let t of pagedTechnicians" class="tech-row" [class.selected]="selectedTechId === t._id" (click)="selectTech(t._id)">
                <td>
                  <span class="tech-cell">
                    <span class="tech-avatar" [style.background]="avatarColor(t.fullName)">{{ initials(t.fullName) }}</span>
                    {{ t.fullName }}
                  </span>
                </td>
                <td class="mono">{{ assignedOf(t._id).length }}</td>
                <td class="mono">{{ completedOf(t._id).length }}</td>
                <td class="mono">{{ cancelledOf(t._id).length }}</td>
                <td class="mono">{{ cancelRateOf(t._id) }}%</td>
                <td class="mono">{{ overdueOf(t._id).length }}</td>
                <td class="mono">{{ rescheduleEventCountOf(t._id) }}</td>
                <td class="mono">{{ hoursOf(t._id) }} {{ i18n.t['hoursUnit'] }}</td>
                <td class="mono">{{ daysWorkedCountOf(t._id) }}</td>
              </tr>
              <tr *ngIf="filteredTechnicians.length === 0">
                <td colspan="9" class="empty-cell">{{ i18n.t['noResults'] }}</td>
              </tr>
            </tbody>
            <tfoot *ngIf="technicians.length > 0">
              <tr class="total-row" [class.selected]="selectedTechId === ALL_ID" (click)="selectTech(ALL_ID)">
                <td>{{ i18n.t['totalLabel'] }}</td>
                <td class="mono">{{ assignedOf(ALL_ID).length }}</td>
                <td class="mono">{{ completedOf(ALL_ID).length }}</td>
                <td class="mono">{{ cancelledOf(ALL_ID).length }}</td>
                <td class="mono">{{ cancelRateOf(ALL_ID) }}%</td>
                <td class="mono">{{ overdueOf(ALL_ID).length }}</td>
                <td class="mono">{{ rescheduleEventCountOf(ALL_ID) }}</td>
                <td class="mono">{{ hoursOf(ALL_ID) }} {{ i18n.t['hoursUnit'] }}</td>
                <td class="mono">{{ daysWorkedCountOf(ALL_ID) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="pagination-bar" *ngIf="filteredTechnicians.length > pageSize">
          <button type="button" class="btn-page" [disabled]="currentPage === 1" (click)="goFirst()">{{ i18n.t['pageFirst'] }}</button>
          <button type="button" class="btn-page" [disabled]="currentPage === 1" (click)="goPrev()">{{ i18n.t['pagePrev'] }}</button>
          <span class="page-jump">
            <input type="number" min="1" [max]="totalPages" [ngModel]="currentPage" (ngModelChange)="goToPage($event)" class="page-input">
            <span class="muted">/ {{ totalPages }}</span>
          </span>
          <button type="button" class="btn-page" [disabled]="currentPage === totalPages" (click)="goNext()">{{ i18n.t['next'] }}</button>
          <button type="button" class="btn-page" [disabled]="currentPage === totalPages" (click)="goLast()">{{ i18n.t['pageLast'] }}</button>
        </div>
      </div>

      <div class="card detail-card" *ngIf="!loading && detailTarget as tech">
        <div class="card-head">
          <div class="head-title tech-title">
            <span class="tech-avatar lg" [style.background]="avatarColor(tech.fullName)">{{ initials(tech.fullName) }}</span>
            {{ tech.fullName }}
            <span class="tech-role-tag" *ngIf="tech.role">{{ i18n.roleLabel(tech.role) }}</span>
          </div>
        </div>

        <div class="stat-grid">
          <button type="button" class="stat-tile clickable" [class.active]="jobFilter === 'all'" (click)="setJobFilter('all')">
            <div class="stat-value mono">{{ assignedOf(tech._id).length }}</div>
            <div class="stat-label">{{ i18n.t['colAssigned'] }}</div>
          </button>
          <button type="button" class="stat-tile clickable" [class.active]="jobFilter === 'completed'" (click)="setJobFilter('completed')">
            <div class="stat-value mono">{{ completedOf(tech._id).length }}</div>
            <div class="stat-label">{{ i18n.statusLabel('completed') }}</div>
          </button>
          <button type="button" class="stat-tile warn clickable" [class.active]="jobFilter === 'cancelled'" (click)="setJobFilter('cancelled')">
            <div class="stat-value mono">{{ cancelledOf(tech._id).length }}</div>
            <div class="stat-label">{{ i18n.statusLabel('cancelled') }} ({{ cancelRateOf(tech._id) }}%)</div>
          </button>
          <button type="button" class="stat-tile clickable" [class.active]="jobFilter === 'overdue'" *ngIf="overdueOf(tech._id).length" (click)="setJobFilter('overdue')">
            <div class="stat-value mono">{{ overdueOf(tech._id).length }}</div>
            <div class="stat-label">{{ i18n.statusLabel('overdue') }}</div>
          </button>
          <button type="button" class="stat-tile clickable" [class.active]="jobFilter === 'rescheduled'" (click)="setJobFilter('rescheduled')">
            <div class="stat-value mono">{{ rescheduleEventCountOf(tech._id) }}</div>
            <div class="stat-label">{{ i18n.t['colRescheduled'] }}</div>
          </button>
          <div class="stat-tile">
            <div class="stat-value mono">{{ hoursOf(tech._id) }} {{ i18n.t['hoursUnit'] }}</div>
            <div class="stat-label">{{ i18n.t['colHoursWorked'] }}</div>
          </div>
          <div class="stat-tile">
            <div class="stat-value mono">{{ daysWorkedCountOf(tech._id) }}</div>
            <div class="stat-label">{{ i18n.t['colDaysWorked'] }}</div>
          </div>
        </div>

        <div class="detail-body">
          <div class="type-panel">
            <div class="panel-title">{{ i18n.t['jobTypeBreakdown'] }} <span class="scope-tag">({{ scopeLabel }})</span></div>
            <button type="button" class="type-row clickable" *ngFor="let tb of typeBreakdownOf(tech._id)" [class.active]="typeFilter === tb.type" (click)="setTypeFilter(tb.type)">
              <span class="type-name">{{ i18n.typeLabel(tb.type) }}</span>
              <div class="type-bar-track"><div class="type-bar-fill" [style.width.%]="tb.pct"></div></div>
              <span class="type-count mono">{{ tb.count }}</span>
            </button>
            <div *ngIf="typeBreakdownOf(tech._id).length === 0" class="empty-note">{{ i18n.t[noJobsKey] }}</div>
          </div>

          <div class="calendar-panel" *ngIf="viewMode === 'month'">
            <div class="panel-title">{{ i18n.t['dailyCalendar'] }} <span class="scope-tag">({{ scopeLabel }})</span></div>
            <div class="mini-dow">
              <span *ngFor="let d of dowShortLabels">{{ d }}</span>
            </div>
            <div class="mini-grid">
              <span class="mini-blank" *ngFor="let b of leadingBlanks"></span>
              <button type="button" class="mini-cell" *ngFor="let d of monthDayNumbers"
                      [class.worked]="workedDayNumbersOf(tech._id).includes(d)"
                      [class.active]="dayFilter === d"
                      (click)="toggleDayFilter(d)">{{ d }}</button>
            </div>
          </div>

          <div class="calendar-panel" *ngIf="viewMode === 'year'">
            <div class="panel-title">{{ i18n.t['monthlyBreakdown'] }} <span class="scope-tag">({{ scopeLabel }})</span></div>
            <div class="type-row" *ngFor="let mb of monthlyBreakdownOf(tech._id)">
              <span class="type-name">{{ mb.label }}</span>
              <div class="type-bar-track"><div class="type-bar-fill" [style.width.%]="mb.pct"></div></div>
              <span class="type-count mono">{{ mb.count }}</span>
            </div>
          </div>
        </div>

        <div class="job-list-head">
          <span class="mono">{{ i18n.t['jobList'] }}</span>
          <button type="button" class="link-btn" *ngIf="jobFilter !== 'all' || typeFilter || dayFilter" (click)="clearJobListFilters()">{{ i18n.t['clearFilter'] }}</button>
          <span class="spacer"></span>
          <span class="mono count">{{ jobsOf(tech._id).length }} / {{ assignedOf(tech._id).length }} {{ i18n.t['items'] }}</span>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ i18n.t['colSr'] }}</th>
                <th>{{ i18n.t['colPlan'] }}</th>
                <th>{{ i18n.t['colType'] }}</th>
                <th>{{ i18n.t['colHospital'] }}</th>
                <th *ngIf="tech._id === ALL_ID">{{ i18n.t['colTech'] }}</th>
                <th>{{ i18n.t['statusLabel'] }}</th>
                <th>{{ i18n.t['colDuration'] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let o of jobsOf(tech._id)" (click)="viewOrder(o._id)" class="clickable">
                <td class="mono">{{ o.srNumber }}</td>
                <td class="mono">
                  {{ o.plannedDate | localDate:'dd/MM/yyyy':'UTC' }}
                  <div class="resched-note" *ngIf="firstRescheduleDate(o) as fromDate" [title]="i18n.t['rescheduleHistory']">
                    ↺ {{ fromDate | localDate:'dd/MM/yyyy':'UTC' }} → {{ o.plannedDate | localDate:'dd/MM/yyyy':'UTC' }}
                    <span *ngIf="rescheduleCountOf(o) > 1">({{ i18n.t['rescheduledCountLabel'] }} {{ rescheduleCountOf(o) }} {{ i18n.t['timesWord'] }})</span>
                  </div>
                </td>
                <td><span class="badge">{{ i18n.typeLabel(o.workType) }}</span></td>
                <td>{{ o.customerName }}</td>
                <td *ngIf="tech._id === ALL_ID">{{ o.technician?.fullName }}</td>
                <td><span class="status-pill" [class]="'st-' + o.status">{{ i18n.statusLabel(o.status) }}</span></td>
                <td class="mono">{{ durationLabel(o) }}</td>
              </tr>
              <tr *ngIf="jobsOf(tech._id).length === 0">
                <td [attr.colspan]="tech._id === ALL_ID ? 7 : 6" class="empty-cell">{{ i18n.t[noJobsKey] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 1500px; margin: 0 auto; }
    .layout { display: flex; align-items: flex-start; gap: 18px; }
    .list-card { flex: 1.2 1 560px; min-width: 0; }
    .detail-card { flex: 1 1 460px; min-width: 0; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .filter-bar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: var(--alt); border-bottom: 1px solid var(--line2); flex-wrap: wrap; }
    .period-toggle { display: flex; border-radius: var(--radius); border: 1px solid var(--line); overflow: hidden; flex: none; }
    .period-toggle button { height: 40px; padding: 0 14px; border: none; border-right: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .period-toggle button:last-child { border-right: none; }
    .period-toggle button.on { background: var(--accent); color: #fff; }
    .muted { font-size: 13px; color: var(--sub); }
    .hint { font-size: 12.5px; }
    .filter-bar app-select.month-select { flex: 0 0 180px; }
    .filter-bar app-select.year-select { flex: 0 0 110px; }
    .spacer { flex: 1; }

    .search-bar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--line2); flex-wrap: wrap; }
    .search-box { border-radius: var(--radius); flex: 1 1 220px; display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); }
    .search-box span { color: var(--sub); font-size: 13px; }
    .search-box input { border: none; background: transparent; outline: none; font-size: 13.5px; width: 100%; color: var(--ink); }
    .count { font-size: 12.5px; color: var(--sub); }

    .empty-state { text-align: center; padding: 60px 20px; color: var(--sub); font-size: 15px; }
    .empty-cell { text-align: center; color: var(--sub); padding: 30px; }
    .empty-note { color: var(--sub); font-size: 12.5px; padding: 6px 0; }

    .table-scroll { overflow-x: auto; }
    .data-table { width: 100%; min-width: 760px; border-collapse: collapse; }
    .data-table th { background: var(--alt); color: var(--sub); border-bottom: 2px solid var(--accent); text-align: left; padding: 11px 14px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }
    .data-table td { padding: 12px 14px; border-bottom: 1px solid var(--line2); font-size: 13px; }
    .tech-row { cursor: pointer; }
    .tech-row:hover { background: var(--alt); }
    .tech-row.selected { background: var(--info-bg); }
    .total-row { font-weight: 700; background: var(--alt); }
    .total-row td { border-top: 2px solid var(--accent); border-bottom: none; }
    .clickable { cursor: pointer; }
    .clickable:hover { background: var(--alt); }
    .badge { display: inline-block; padding: 2px 8px; background: var(--info-bg); color: var(--info-text); border: 1px solid var(--info-line); border-radius: var(--radius); font-size: 11.5px; font-weight: 600; }
    .resched-note { font-size: 10.5px; color: var(--sub); font-weight: 400; white-space: nowrap; }

    .tech-cell { display: flex; align-items: center; gap: 10px; }
    .tech-avatar { border-radius: 8px; width: 28px; height: 28px; flex: none; color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
    .tech-avatar.lg { width: 38px; height: 38px; font-size: 13px; }
    .tech-title { display: flex; align-items: center; gap: 12px; }
    .tech-role-tag { font-size: 11.5px; font-weight: 600; color: var(--sub); background: var(--alt); border: 1px solid var(--line2); border-radius: var(--radius); padding: 3px 9px; }

    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--line2); }
    .stat-tile { border-radius: var(--radius); border: 1px solid var(--line2); background: var(--alt); padding: 12px 14px; }
    .stat-tile.warn { border-color: var(--danger-line, var(--line2)); }
    .stat-tile.clickable { font: inherit; color: inherit; text-align: left; width: 100%; }
    .stat-tile.clickable:hover { border-color: var(--accent); background: var(--surface); }
    .stat-tile.clickable.active { border-color: var(--accent); background: var(--info-bg); }
    .stat-value { font-size: 20px; font-weight: 700; }
    .stat-label { font-size: 11.5px; color: var(--sub); margin-top: 2px; }

    .detail-body { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; padding: 18px 20px; border-bottom: 1px solid var(--line2); }
    .panel-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
    .scope-tag { font-weight: 400; color: var(--sub); font-size: 12px; }

    .type-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
    .type-row.clickable { width: 100%; border: none; background: transparent; font: inherit; color: inherit; cursor: pointer; border-radius: 6px; }
    .type-row.clickable:hover { background: var(--alt); }
    .type-row.clickable.active { background: var(--info-bg); }
    .type-row.clickable.active .type-name { color: var(--ink); font-weight: 700; }
    .type-name { flex: 0 0 110px; font-size: 12.5px; color: var(--sub); }
    .type-bar-track { flex: 1; height: 8px; border-radius: 999px; background: var(--line2); overflow: hidden; }
    .type-bar-fill { height: 100%; background: var(--accent); border-radius: 999px; }
    .type-count { flex: 0 0 24px; text-align: right; font-size: 12.5px; }

    .mini-dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
    .mini-dow span { text-align: center; font-size: 10.5px; color: var(--sub); }
    .mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .mini-blank { visibility: hidden; }
    .mini-cell, .mini-blank { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 11px; color: var(--sub); background: var(--alt); border: 1px solid var(--line2); }
    .mini-cell { font: inherit; cursor: pointer; padding: 0; }
    .mini-cell:hover { border-color: var(--accent); }
    .mini-cell.worked { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 700; }
    .mini-cell.active { outline: 2px solid var(--ink); outline-offset: 1px; }

    .job-list-head { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--line2); font-size: 13px; font-weight: 700; }
    .job-list-head .spacer { flex: 1; }
    .job-list-head .count { font-weight: 400; color: var(--sub); }
    .link-btn { border: none; background: transparent; color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer; }
    .link-btn:hover { text-decoration: underline; }

    .status-pill { display: inline-block; padding: 2px 8px; border-radius: var(--radius); font-size: 11.5px; font-weight: 600; background: var(--alt); border: 1px solid var(--line2); color: var(--sub); }
    .status-pill.st-draft, .status-pill.st-pending_approval, .status-pill.st-rescheduled { background: var(--warn-bg); color: var(--warn-text); border-color: var(--warn-line); }
    .status-pill.st-approved { background: var(--info-bg); color: var(--info-text); border-color: var(--info-line); }
    .status-pill.st-in_progress, .status-pill.st-completed { background: var(--success-bg); color: var(--success-text); border-color: var(--success-line); }
    .status-pill.st-overdue { background: var(--danger-bg); color: var(--danger-text); border-color: var(--danger-line); }
    .status-pill.st-cancelled { opacity: .7; text-decoration: line-through; }

    .pagination-bar { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--line2); }
    .btn-page { border-radius: var(--radius); height: 36px; padding: 0 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .btn-page:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    .btn-page:disabled { opacity: 0.45; cursor: not-allowed; }
    .page-jump { display: flex; align-items: center; gap: 6px; font-size: 12.5px; margin: 0 4px; }
    .page-input { width: 52px; height: 36px; border-radius: var(--radius); border: 1px solid var(--line); background: var(--field); color: var(--ink); text-align: center; font-size: 13px; }
    .page-input:focus { border-color: var(--accent); outline: none; }
    .page-input::-webkit-outer-spin-button,
    .page-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .page-input[type=number] { -moz-appearance: textfield; }

    @media (max-width: 1100px) {
      .layout { flex-direction: column; }
      .list-card, .detail-card { flex: 1 1 auto; width: 100%; }
    }
    @media (max-width: 900px) {
      .detail-body { grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) {
      .filter-bar { flex-direction: column; align-items: stretch; }
      .filter-bar app-select.month-select, .filter-bar app-select.year-select { flex: 1 1 auto; }
    }
  `]
})
export class TechDashboardComponent implements OnInit {
  technicians: User[] = [];
  filteredTechnicians: User[] = [];
  orders: WorkOrder[] = [];
  loading = false;
  viewMode: 'month' | 'year' = 'month';
  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();
  selectedTechId: string | null = null;
  searchText = '';
  pageSize = 10;
  currentPage = 1;
  jobFilter: 'all' | 'completed' | 'cancelled' | 'overdue' | 'rescheduled' = 'all';
  typeFilter: string | null = null;
  dayFilter: number | null = null;

  years = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i);
  readonly ALL_ID = '__ALL__';

  constructor(
    private workOrderService: WorkOrderService,
    private userService: UserService,
    public auth: AuthService,
    public i18n: I18nService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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

  get dowShortLabels(): string[] {
    return this.i18n.lang === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }

  get monthDayNumbers(): number[] {
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }

  get leadingBlanks(): number[] {
    const firstWeekday = new Date(this.selectedYear, this.selectedMonth - 1, 1).getDay();
    return Array.from({ length: firstWeekday }, (_, i) => i);
  }

  get sortedTechnicians(): User[] {
    return this.technicians.slice().sort((a, b) => this.assignedOf(b._id).length - this.assignedOf(a._id).length);
  }

  applyFilter(resetPage: boolean = true) {
    const q = this.searchText.trim().toLowerCase();
    const list = this.sortedTechnicians;
    this.filteredTechnicians = q
      ? list.filter(t => t.fullName.toLowerCase().includes(q))
      : list;
    this.currentPage = resetPage ? 1 : Math.min(this.currentPage, this.totalPages);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTechnicians.length / this.pageSize));
  }

  get pagedTechnicians(): User[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTechnicians.slice(start, start + this.pageSize);
  }

  goToPage(page: number) {
    const target = Math.floor(page) || 1;
    this.currentPage = Math.min(Math.max(1, target), this.totalPages);
  }

  goFirst() { this.goToPage(1); }
  goPrev() { this.goToPage(this.currentPage - 1); }
  goNext() { this.goToPage(this.currentPage + 1); }
  goLast() { this.goToPage(this.totalPages); }

  get detailTarget(): { _id: string; fullName: string; role: string } | null {
    if (this.selectedTechId === this.ALL_ID) {
      return { _id: this.ALL_ID, fullName: this.i18n.t['totalLabel'], role: '' };
    }
    return this.technicians.find(t => t._id === this.selectedTechId) || null;
  }

  get noJobsKey(): string {
    return this.viewMode === 'month' ? 'noJobsThisMonth' : 'noJobsThisYear';
  }

  ngOnInit() {
    this.userService.getTeamMembers().subscribe({
      next: (list) => {
        this.technicians = list;
        this.applyFilter(false);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading team members:', err)
    });
    this.workOrderService.getWorkTypes().subscribe(meta => {
      this.knownWorkTypes = meta.types.filter(t => t !== meta.otherType);
      this.otherWorkType = meta.otherType;
      this.cdr.detectChanges();
    });
    this.loadData();
  }

  setViewMode(mode: 'month' | 'year') {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.jobFilter = 'all';
    this.typeFilter = null;
    this.dayFilter = null;
    const month = this.viewMode === 'month' ? this.selectedMonth : undefined;
    this.workOrderService.getAllOrders(month, this.selectedYear).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectTech(id: string) {
    this.selectedTechId = this.selectedTechId === id ? null : id;
    this.jobFilter = 'all';
    this.typeFilter = null;
    this.dayFilter = null;
  }

  setJobFilter(filter: 'all' | 'completed' | 'cancelled' | 'overdue' | 'rescheduled') {
    this.jobFilter = this.jobFilter === filter ? 'all' : filter;
    this.dayFilter = null;
  }

  setTypeFilter(type: string) {
    this.typeFilter = this.typeFilter === type ? null : type;
  }

  toggleDayFilter(day: number) {
    this.dayFilter = this.dayFilter === day ? null : day;
  }

  clearJobListFilters() {
    this.jobFilter = 'all';
    this.typeFilter = null;
    this.dayFilter = null;
  }

  private techIdOf(order: WorkOrder): string | null {
    const t: any = order.technician;
    if (!t) return null;
    return typeof t === 'object' ? t._id : t;
  }

  private parseTime(t?: string): number | null {
    if (!t) return null;
    const parts = t.split(':').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] + parts[1] / 60;
  }

  private durationOf(order: WorkOrder): number {
    const start = this.parseTime(order.actualStartTime) ?? this.parseTime(order.plannedStartTime);
    const end = this.parseTime(order.actualEndTime) ?? this.parseTime(order.plannedEndTime);
    if (start != null && end != null && end > start) return Math.round((end - start) * 10) / 10;
    return 1;
  }

  durationLabel(order: WorkOrder): string {
    return `${this.durationOf(order)} ${this.i18n.t['hoursUnit']}`;
  }

  assignedOf(techId: string): WorkOrder[] {
    if (techId === this.ALL_ID) return this.orders;
    return this.orders.filter(o => this.techIdOf(o) === techId);
  }

  jobsOf(techId: string): WorkOrder[] {
    return this.assignedOf(techId)
      .filter(o => this.matchesJobFilter(o) && this.matchesTypeFilter(o) && this.matchesDayFilter(o))
      .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime());
  }

  private matchesDayFilter(o: WorkOrder): boolean {
    return this.dayFilter == null || this.dateOf(o).getDate() === this.dayFilter;
  }

  private statusFilteredOf(techId: string): WorkOrder[] {
    return this.assignedOf(techId).filter(o => this.matchesJobFilter(o));
  }

  private matchesTypeFilter(o: WorkOrder): boolean {
    if (!this.typeFilter) return true;
    return this.normalizeWorkType(o.workType) === this.typeFilter;
  }

  private matchesJobFilter(o: WorkOrder): boolean {
    switch (this.jobFilter) {
      case 'completed': return o.status === 'completed';
      case 'cancelled': return o.status === 'cancelled';
      case 'overdue': return o.status === 'overdue' || o.isOverdue;
      case 'rescheduled': return (o.rescheduleHistory || []).length > 0;
      default: return true;
    }
  }

  completedOf(techId: string): WorkOrder[] {
    return this.assignedOf(techId).filter(o => o.status === 'completed');
  }

  cancelledOf(techId: string): WorkOrder[] {
    return this.assignedOf(techId).filter(o => o.status === 'cancelled');
  }

  overdueOf(techId: string): WorkOrder[] {
    return this.assignedOf(techId).filter(o => o.status === 'overdue' || o.isOverdue);
  }

  rescheduleEventCountOf(techId: string): number {
    return this.assignedOf(techId).reduce((sum, o) => sum + (o.rescheduleHistory || []).length, 0);
  }

  cancelRateOf(techId: string): number {
    const total = this.assignedOf(techId).length;
    if (!total) return 0;
    return Math.round((this.cancelledOf(techId).length / total) * 1000) / 10;
  }

  hoursOf(techId: string): number {
    return Math.round(this.completedOf(techId).reduce((a, o) => a + this.durationOf(o), 0) * 10) / 10;
  }

  firstRescheduleDate(order: WorkOrder): string | null {
    const history = order.rescheduleHistory || [];
    return history.length > 0 ? history[0].fromDate : null;
  }

  rescheduleCountOf(order: WorkOrder): number {
    return (order.rescheduleHistory || []).length;
  }

  // actualDate และ plannedDate เก็บเป็น UTC midnight แปลงเป็น local midnight กันคนเรียกใช้ getDate ผิดวัน
  private dateOf(order: WorkOrder): Date {
    const raw = new Date(order.actualDate || order.plannedDate);
    return new Date(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate());
  }

  daysWorkedCountOf(techId: string): number {
    const days = new Set<string>();
    for (const o of this.completedOf(techId)) {
      const d = this.dateOf(o);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return days.size;
  }

  get scopeLabel(): string {
    const key = this.jobFilter === 'all' ? 'completed' : this.jobFilter;
    const dictKey = 'scope' + key.charAt(0).toUpperCase() + key.slice(1);
    return this.i18n.t[dictKey];
  }

  private analyticsSourceOf(techId: string): WorkOrder[] {
    return this.jobFilter === 'all' ? this.completedOf(techId) : this.statusFilteredOf(techId);
  }

  workedDayNumbersOf(techId: string): number[] {
    return this.analyticsSourceOf(techId).map(o => this.dateOf(o).getDate());
  }

  monthlyBreakdownOf(techId: string): TypeBreakdown[] {
    const locale = this.i18n.lang === 'th' ? 'th-TH' : 'en-US';
    const counts = new Array(12).fill(0);
    for (const o of this.analyticsSourceOf(techId)) counts[this.dateOf(o).getMonth()]++;
    const max = Math.max(1, ...counts);
    return counts.map((count, i) => ({
      type: String(i + 1),
      label: new Date(2000, i, 1).toLocaleDateString(locale, { month: 'short' }),
      count,
      pct: Math.round((count / max) * 100)
    }));
  }

  private knownWorkTypes: string[] = [];
  private otherWorkType = '';

  private normalizeWorkType(workType: string): string {
    return this.knownWorkTypes.includes(workType) ? workType : this.otherWorkType;
  }

  typeBreakdownOf(techId: string): TypeBreakdown[] {
    const jobs = this.analyticsSourceOf(techId);
    const counts = new Map<string, number>();
    for (const o of jobs) {
      const type = this.normalizeWorkType(o.workType);
      counts.set(type, (counts.get(type) || 0) + 1);
    }
    const max = Math.max(1, ...Array.from(counts.values()));
    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count, pct: Math.round((count / max) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  initials(name?: string): string {
    if (!name) return '';
    return name.replace(/\s+/g, ' ').split(' ')[0].slice(0, 2);
  }

  private static readonly AVATAR_PALETTE = [
    '#0d8f72', '#2563eb', '#7c5cd4', '#d9611f', '#8a7a1a', '#1b7ea8', '#b2457a', '#4a6b3a'
  ];

  avatarColor(seed?: string): string {
    if (!seed) return 'var(--avatar)';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return TechDashboardComponent.AVATAR_PALETTE[hash % TechDashboardComponent.AVATAR_PALETTE.length];
  }

  viewOrder(id: string) {
    this.router.navigate(['/work-orders', id]);
  }

  back() {
    window.history.back();
  }
}
