import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WorkOrderService, WorkOrder } from '../../services/work-order.service';
import { AuthService, User } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';
import { ScheduleSearchService } from '../../services/schedule-search.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-calendar',
  standalone: false,
  template: `
    <div class="cal-shell">
      <div class="toolbar">
        <div class="tabs">
          <button [class.active]="view === 'month'" (click)="setView('month')">{{ i18n.t['viewMonth'] }}</button>
          <button [class.active]="view === 'week'" (click)="setView('week')">{{ i18n.t['viewWeek'] }}</button>
          <button [class.active]="view === 'day'" (click)="setView('day')">{{ i18n.t['viewDay'] }}</button>
        </div>

        <div class="period-nav">
          <button (click)="prevPeriod()">‹</button>
          <button type="button" class="period-label" (click)="toggleMonthPicker()">{{ periodLabel }}</button>
          <button (click)="nextPeriod()">›</button>

          <div class="month-picker" *ngIf="showMonthPicker">
            <div class="mp-head">
              <button type="button" class="mp-nav" (click)="pickerYear = pickerYear - 1">‹</button>
              <div class="mp-year mono">{{ pickerYearLabel }}</div>
              <button type="button" class="mp-nav" (click)="pickerYear = pickerYear + 1">›</button>
            </div>
            <div class="mp-grid">
              <button type="button" *ngFor="let m of monthNames; let i = index"
                      class="mp-month"
                      [class.selected]="isPickerMonthSelected(i)"
                      (click)="pickMonth(i)">
                {{ m }}
              </button>
            </div>
          </div>
        </div>
        <button class="today-btn" (click)="goToday()">{{ i18n.t['today'] }}</button>

        <div class="row-break"></div>

        <div class="stats">
          <span class="mono">{{ stats.total }} {{ i18n.t['jobsUnit'] }}</span>
          <span class="mono tone-warn">{{ i18n.t['statQueued'] }} {{ stats.queued }}</span>
        </div>

        <div class="legend">
          <span class="legend-item"><span class="dot" style="background:#d98b1e"></span>{{ i18n.statusLabel('pending_approval') }}</span>
          <span class="legend-item"><span class="dot" style="background:#2563eb"></span>{{ i18n.statusLabel('approved') }}</span>
          <span class="legend-item"><span class="dot" style="background:#0d8f72"></span>{{ i18n.statusLabel('completed') }}</span>
          <span class="legend-item"><span class="dot" style="background:#c2410c"></span>{{ i18n.statusLabel('overdue') }}</span>
          <span class="legend-item"><span class="dot" style="background:#8d949c;opacity:.55"></span>{{ i18n.statusLabel('cancelled') }}</span>
        </div>

        <div class="row-break"></div>

        <div class="spacer"></div>

        <div class="scope-toggle" *ngIf="auth.isSupervisor">
          <button [class.on]="!showAll" (click)="setScope(false)">{{ i18n.t['scopeMine'] }}</button>
          <button [class.on]="showAll" (click)="setScope(true)">{{ i18n.t['scopeAll'] }}</button>
        </div>
        <button class="add-btn" (click)="addNewWork()">+ {{ i18n.t['navAdd'] }}</button>
      </div>

      <div class="body">
        <aside class="sidebar" *ngIf="auth.isSupervisor && showAll">
          <button type="button" class="sidebar-head collapsible" *ngIf="overdueOrders.length > 0" (click)="overdueCollapsed = !overdueCollapsed">
            <span class="mono tone-danger">{{ i18n.t['overdueAlert'] }}</span>
            <span class="collapsible-right">
              <span class="count-badge tone-danger-badge">{{ overdueOrders.length }}</span>
              <span class="collapse-caret" [class.collapsed]="overdueCollapsed">▾</span>
            </span>
          </button>
          <div class="overdue-list" *ngIf="overdueOrders.length > 0 && !overdueCollapsed">
            <div *ngFor="let o of overdueOrders" class="queue-item overdue-item" (click)="viewOrder(o._id)">
              <div class="queue-row">
                <span class="mono">{{ o.srNumber }}</span>
                <span class="mono tone-danger">{{ o.overdueDays }} {{ i18n.t['overdueDaysSuffix'] }}</span>
              </div>
              <div class="queue-customer">{{ o.customerName }}</div>
            </div>
          </div>

          <button type="button" class="sidebar-head collapsible" (click)="teamCollapsed = !teamCollapsed">
            <span class="mono">{{ i18n.t['team'] }}</span>
            <span class="collapsible-right">
              <span class="count-badge">{{ technicians.length }}</span>
              <span class="collapse-caret" [class.collapsed]="teamCollapsed">▾</span>
            </span>
          </button>
          <div class="tech-list" *ngIf="!teamCollapsed">
            <div class="list-toolbar">
              <button class="link-btn" (click)="clearFilters()">{{ i18n.t['clearFilter'] }}</button>
            </div>
            <button *ngFor="let t of technicians" class="tech-row" [class.on]="filterTech === t._id" (click)="toggleTechFilter(t._id)">
              <span class="tech-avatar" [style.background]="filterTech === t._id ? null : avatarColor(t.fullName)">{{ initials(t.fullName) }}</span>
              <span class="tech-meta">
                <span class="tech-name">{{ t.fullName }}</span>
                <span class="tech-role">{{ i18n.roleLabel(t.role) }}</span>
              </span>
              <span class="tech-hours mono" [title]="i18n.t['techLoad']">{{ techHours(t._id) ? techHours(t._id) + ' ' + i18n.t['hoursUnit'] : '-' }}</span>
            </button>
            <div *ngIf="technicians.length === 0" class="empty-note">{{ i18n.t['noResults'] }}</div>
          </div>

          <button type="button" class="sidebar-head collapsible" (click)="queueCollapsed = !queueCollapsed">
            <span class="mono">{{ i18n.t['queueTitle'] }}</span>
            <span class="collapsible-right">
              <span class="count-badge tone-warn-badge">{{ pendingApproval.length }}</span>
              <span class="collapse-caret" [class.collapsed]="queueCollapsed">▾</span>
            </span>
          </button>
          <div class="queue-list" *ngIf="!queueCollapsed">
            <div *ngFor="let o of pendingApproval" class="queue-item" (click)="viewOrder(o._id)">
              <div class="queue-row">
                <span class="mono">{{ o.srNumber }}</span>
                <span class="mono">{{ o.plannedDate | localDate:'d MMM':'UTC' }}</span>
              </div>
              <div class="queue-customer">{{ o.customerName }}</div>
              <div class="queue-sub">{{ i18n.typeLabel(o.workType) }} · {{ o.technician?.fullName }}</div>
              <div class="queue-window mono">{{ timeWindow(o) }}</div>
            </div>
            <div *ngIf="pendingApproval.length === 0" class="empty-note">{{ i18n.t['noResults'] }}</div>
          </div>
        </aside>

        <aside class="sidebar" *ngIf="!(auth.isSupervisor && showAll)">
          <button type="button" class="sidebar-head collapsible" *ngIf="myOverdueOrders.length > 0" (click)="myOverdueCollapsed = !myOverdueCollapsed">
            <span class="mono tone-danger">{{ i18n.t['overdueAlert'] }}</span>
            <span class="collapsible-right">
              <span class="count-badge tone-danger-badge">{{ myOverdueOrders.length }}</span>
              <span class="collapse-caret" [class.collapsed]="myOverdueCollapsed">▾</span>
            </span>
          </button>
          <div class="overdue-list" *ngIf="myOverdueOrders.length > 0 && !myOverdueCollapsed">
            <div *ngFor="let o of myOverdueOrders" class="queue-item overdue-item" (click)="viewOrder(o._id)">
              <div class="queue-row">
                <span class="mono">{{ o.srNumber }}</span>
                <span class="mono tone-danger">{{ o.overdueDays }} {{ i18n.t['overdueDaysSuffix'] }}</span>
              </div>
              <div class="queue-customer">{{ o.customerName }}</div>
            </div>
          </div>

          <button type="button" class="sidebar-head collapsible" (click)="myPendingCollapsed = !myPendingCollapsed">
            <span class="mono">{{ i18n.t['myPendingTitle'] }}</span>
            <span class="collapsible-right">
              <span class="count-badge tone-warn-badge">{{ pendingApproval.length }}</span>
              <span class="collapse-caret" [class.collapsed]="myPendingCollapsed">▾</span>
            </span>
          </button>
          <div class="queue-list" *ngIf="!myPendingCollapsed">
            <div *ngFor="let o of pendingApproval" class="queue-item" (click)="viewOrder(o._id)">
              <div class="queue-row">
                <span class="mono">{{ o.srNumber }}</span>
                <span class="mono">{{ o.plannedDate | localDate:'d MMM':'UTC' }}</span>
              </div>
              <div class="queue-customer">{{ o.customerName }}</div>
              <div class="queue-sub">{{ i18n.typeLabel(o.workType) }}</div>
              <div class="queue-window mono">{{ timeWindow(o) }}</div>
            </div>
            <div *ngIf="pendingApproval.length === 0" class="empty-note">{{ i18n.t['noResults'] }}</div>
          </div>
        </aside>

        <main class="main-view">
          <!-- Month view -->
          <div *ngIf="view === 'month'" class="month-grid">
            <div class="dow-cell mono" *ngFor="let d of dowShortLabels">{{ d }}</div>
            <div class="day-cell" *ngFor="let day of calendarDays"
                 [class.other-month]="!day.isCurrentMonth" [class.today]="day.isToday"
                 (click)="onDayClick(day)">
              <div class="day-num mono">{{ day.date.getDate() }}</div>
              <div class="job-chip" *ngFor="let order of day.orders" [ngClass]="statusClass(order.status)"
                   (click)="viewOrder(order._id); $event.stopPropagation()">
                <div class="chip-sr mono">{{ order.srNumber }}</div>
                <div class="chip-title">{{ order.customerName }}</div>
                <div class="chip-sub">{{ i18n.typeLabel(order.workType) }}<span *ngIf="showAll"> · {{ order.technician?.fullName }}</span></div>
              </div>
            </div>
          </div>

          <!-- Week view -->
          <div *ngIf="view === 'week'" class="week-view">
            <div class="week-col" *ngFor="let day of weekColumns">
              <div class="week-col-head" [class.today]="day.isToday">
                <div><span class="dow">{{ day.dowLabel }}</span> <span class="mono num">{{ day.date.getDate() }}</span></div>
                <div class="week-col-count mono">{{ day.orders.length }} {{ i18n.t['jobsUnit'] }}</div>
              </div>
              <div class="week-col-body">
                <div class="job-card" *ngFor="let order of day.orders" [ngClass]="statusClass(order.status)" (click)="viewOrder(order._id)">
                  <div class="card-top mono"><span>{{ timeWindow(order) }}</span><span>{{ i18n.statusLabel(order.status) }}</span></div>
                  <div class="card-title">{{ order.customerName }}</div>
                  <div class="card-sub">{{ i18n.typeLabel(order.workType) }} · {{ order.srNumber }}</div>
                  <div class="card-tech" *ngIf="showAll">{{ order.technician?.fullName }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Day view -->
          <div *ngIf="view === 'day'" class="day-view">
            <div class="day-scale-wrap">
              <div class="day-head-row">
                <div class="tech-col-head mono">{{ i18n.t['owner'] }}</div>
                <div class="hours-head">
                  <div class="hour-cell mono" *ngFor="let h of hours">{{ h }}:00</div>
                </div>
              </div>
              <div class="day-row" *ngFor="let row of dayRows">
                <div class="tech-col">
                  <span class="tech-avatar" [style.background]="avatarColor(row.name)">{{ initials(row.name) }}</span>
                  <span class="tech-meta">
                    <span class="tech-name">{{ row.name }}</span>
                    <span class="tech-role mono" *ngIf="row.hoursLabel">{{ row.hoursLabel }}</span>
                  </span>
                </div>
                <div class="hours-track">
                  <div class="hour-line" *ngFor="let h of hours"></div>
                  <div class="job-block" *ngFor="let order of row.orders" [ngClass]="statusClass(order.status)"
                       [style.left]="blockLeft(order)" [style.width]="blockWidth(order)"
                       (click)="viewOrder(order._id)">
                    <div class="block-title">{{ order.customerName }} · {{ i18n.typeLabel(order.workType) }}</div>
                    <div class="block-sub mono">{{ timeWindow(order) }} · {{ order.srNumber }}</div>
                  </div>
                </div>
              </div>
              <div *ngIf="dayRows.length === 0" class="empty-note">{{ i18n.t['noResults'] }}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .cal-shell { display: flex; flex-direction: column; height: calc(100vh - 62px); min-height: 0; }

    .toolbar {
      display: flex; align-items: center; gap: 12px; padding: 9px 16px;
      border-bottom: 1px solid var(--line); flex: none; flex-wrap: wrap; background: var(--surface);
    }
    .tabs, .period-nav, .scope-toggle { border-radius: var(--radius); display: flex; border: 1px solid var(--line); overflow: hidden; }
    .tabs button, .scope-toggle button {
      height: 36px; padding: 0 15px; border: none; border-right: 1px solid var(--line);
      background: var(--surface); color: var(--sub); font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .tabs button:last-child, .scope-toggle button:last-child { border-right: none; }
    .tabs button.active, .scope-toggle button.on { background: #14161a; color: #fff; }
    .scope-toggle button.on { background: var(--accent); }
    .tabs button:hover, .scope-toggle button:hover { filter: brightness(1.05); }

    .period-nav { position: relative; overflow: visible; }
    .period-nav button { width: 34px; height: 36px; border: none; background: var(--surface); color: var(--sub); font-size: 15px; cursor: pointer; }
    .period-nav button:hover { color: var(--accent); }
    .period-nav .period-label { display: flex; align-items: center; padding: 0 14px; min-width: 176px; font-size: 13px; font-weight: 600; border-left: 1px solid var(--line); border-right: 1px solid var(--line); justify-content: center; font-family: inherit; color: var(--ink); }
    .period-nav .period-label:hover { color: var(--accent); background: var(--alt); }

    .month-picker {
      position: absolute; top: calc(100% + 6px); left: 50%; margin-left: -120px; z-index: 30;
      width: 240px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      padding: 12px; box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26); animation: modalIn .16s ease both;
    }
    .mp-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .mp-nav { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--sub); font-size: 14px; }
    .mp-nav:hover { border-color: var(--accent); color: var(--accent); }
    .mp-year { font-size: 13px; font-weight: 700; color: var(--ink); }
    .mp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
    .mp-month { height: 36px; border-radius: 8px; border: 1px solid transparent; background: var(--alt); color: var(--ink); font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .mp-month:hover { border-color: var(--accent); }
    .mp-month.selected { background: var(--accent); color: #fff; border-color: var(--accent); }
    .today-btn {
      height: 36px; padding: 0 14px; border-radius: var(--radius); border: 1px solid var(--line);
      background: var(--surface); color: var(--ink); font-size: 12.5px; font-weight: 600; cursor: pointer;
    }
    .today-btn:hover { border-color: var(--accent); color: var(--accent); }

    .stats { display: flex; align-items: center; gap: 5px; font-size: 13px; flex-wrap: wrap; }
    .tone-info { color: var(--info-text); }
    .tone-warn { color: var(--warn-text); }
    .tone-danger { color: var(--danger-text); }

    .legend { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 12px; color: var(--sub); }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }

    .spacer { flex: 1; min-width: 8px; }
    .add-btn {
      border-radius: var(--radius); height: 36px; padding: 0 16px; border: 1px solid var(--accent);
      background: var(--accent); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .add-btn:hover { background: var(--accent-hover); }

    .body { display: flex; flex: 1; min-height: 0; }

    .sidebar { width: 280px; flex: none; background: var(--surface); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
    .sidebar-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 8px; flex: none; font-size: 10px; letter-spacing: 0.1em; color: var(--sub); }
    .sidebar-head .tone-danger { letter-spacing: normal; font-size: 12px; font-weight: 700; }
    .sidebar-head.collapsible { width: 100%; border: none; border-top: 1px solid var(--line2); background: transparent; font-family: inherit; cursor: pointer; }
    .sidebar-head.collapsible:first-child { border-top: none; }
    .sidebar-head.collapsible:hover .mono, .sidebar-head.collapsible:hover .tone-danger { text-decoration: underline; }
    .collapsible-right { display: flex; align-items: center; gap: 8px; }
    .collapse-caret { font-size: 12px; color: var(--sub); transition: transform 0.15s ease; }
    .collapse-caret.collapsed { transform: rotate(-90deg); }
    .link-btn { border: none; background: transparent; font-size: 12px; color: var(--accent); cursor: pointer; padding: 0; }
    .count-badge { border-radius: 10px; font-size: 12px; font-weight: 600; color: var(--sub); background: var(--alt); border: 1px solid var(--line2); padding: 1px 8px; }
    .count-badge.tone-danger-badge { color: var(--danger-text); background: var(--danger-bg); border-color: var(--danger-line); }
    .count-badge.tone-warn-badge { color: var(--warn-text); background: var(--warn-bg); border-color: var(--warn-line); }
    .overdue-list { flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
    .queue-item.overdue-item { border-left-color: #c2410c; padding: 10px 12px; gap: 4px; }
    .tech-list { flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 0 12px 12px; display: flex; flex-direction: column; gap: 4px; }
    .list-toolbar { display: flex; justify-content: flex-end; padding: 10px 0 2px; }
    .tech-row {
      border-radius: var(--radius); display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
      padding: 7px 8px; border: 1px solid var(--line); background: var(--surface); cursor: pointer;
    }
    .tech-row.on { border-color: var(--accent); background: var(--info-bg); }
    .tech-row:hover { border-color: var(--accent); }
    .tech-avatar { border-radius: 8px; width: 28px; height: 28px; flex: none; background: var(--avatar); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
    .tech-row.on .tech-avatar { background: var(--accent); }
    .tech-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .tech-name { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
    .tech-role { font-size: 11px; color: var(--sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tech-hours { font-size: 11px; color: var(--sub); }
    .queue-list { flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 12px 14px 18px; display: flex; flex-direction: column; gap: 10px; }
    .queue-item { border-radius: var(--radius); border: 1px solid var(--line); border-left: 4px solid #d98b1e; background: var(--surface); padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; }
    .queue-item:hover { border-color: var(--accent); }
    .queue-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--sub); }
    .queue-customer { font-size: 14px; font-weight: 600; }
    .queue-sub { font-size: 12px; color: var(--sub); }
    .queue-window { font-size: 11px; color: var(--sub); }
    .empty-note { font-size: 12.5px; color: var(--sub); padding: 10px 4px; }

    .main-view { flex: 1; min-width: 0; overflow: auto; background: var(--surface); }

    .month-grid { display: grid; grid-template-columns: repeat(7, minmax(132px, 1fr)); min-width: 980px; }
    .dow-cell { padding: 10px 12px 9px; background: var(--alt); color: var(--sub); border-right: 1px solid var(--line2); border-bottom: 2px solid var(--accent); text-align: center; font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; position: sticky; top: 0; z-index: 2; }
    .day-cell { min-height: 126px; border-right: 1px solid var(--line2); border-bottom: 1px solid var(--line2); background: var(--surface); padding: 7px 8px 10px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
    .day-cell:hover { background: var(--alt); }
    .day-cell.other-month { background: var(--out-bg); color: var(--out-ink); }
    .day-cell.today { background: var(--today-bg); }
    .day-num { font-size: 13px; font-weight: 600; }
    .job-chip { border-radius: var(--radius); border: 1px solid var(--line); border-left: 4px solid var(--sub); background: var(--alt); padding: 6px 7px; cursor: pointer; }
    .job-chip:hover { filter: brightness(1.06); }
    .chip-sr { font-size: 10.5px; color: var(--sub); }
    .chip-title { font-size: 12px; font-weight: 600; line-height: 1.3; margin-top: 2px; }
    .chip-sub { font-size: 11px; color: var(--sub); margin-top: 2px; }

    .week-view { display: flex; align-items: stretch; min-width: 1040px; height: 100%; }
    .week-col { flex: 1; min-width: 148px; border-right: 1px solid var(--line2); display: flex; flex-direction: column; }
    .week-col-head { padding: 9px 12px; background: var(--alt); border-bottom: 1px solid var(--line); }
    .week-col-head.today { background: var(--today-bg); }
    .week-col-head .dow { font-size: 13px; font-weight: 700; }
    .week-col-head .num { font-size: 15px; font-weight: 600; margin-left: 6px; }
    .week-col-count { font-size: 11px; color: var(--sub); margin-top: 2px; }
    .week-col-body { flex: 1; padding: 9px 9px 16px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
    .job-card { border-radius: var(--radius); border: 1px solid var(--line); border-left: 4px solid var(--sub); background: var(--alt); padding: 8px 9px; cursor: pointer; }
    .job-card:hover { filter: brightness(1.06); }
    .card-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 11px; color: var(--sub); }
    .card-title { font-size: 12.5px; font-weight: 600; line-height: 1.35; margin-top: 4px; }
    .card-sub { font-size: 11.5px; color: var(--sub); margin-top: 3px; }
    .card-tech { font-size: 11.5px; margin-top: 6px; }

    .day-view { min-width: 100%; }
    .day-scale-wrap { min-width: 2080px; }
    .day-head-row { display: flex; position: sticky; top: 0; z-index: 2; background: var(--surface); border-bottom: 1px solid var(--line); }
    .tech-col-head { width: 226px; flex: none; padding: 9px 14px; font-size: 10px; letter-spacing: 0.12em; color: var(--sub); }
    .hours-head { flex: 1; display: flex; }
    .hour-cell { flex: 1; border-right: 1px solid var(--line2); padding: 9px 0 7px 7px; font-size: 11px; color: var(--sub); }
    .day-row { display: flex; border-bottom: 1px solid var(--line2); }
    .tech-col { width: 226px; flex: none; border-right: 1px solid var(--line); padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
    .hours-track { flex: 1; position: relative; height: 62px; }
    .hour-line { position: absolute; top: 0; bottom: 0; border-right: 1px solid var(--line2); }
    .day-row .hours-track { display: flex; }
    .job-block { border-radius: var(--radius); position: absolute; top: 8px; bottom: 8px; background: var(--alt); border: 1px solid var(--line); border-left: 4px solid var(--sub); padding: 5px 8px; overflow: hidden; cursor: pointer; }
    .job-block:hover { filter: brightness(1.06); }
    .block-title { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .block-sub { font-size: 11px; color: var(--sub); }

    .st-warn { border-left-color: #d98b1e !important; background: var(--warn-bg) !important; }
    .st-info { border-left-color: var(--accent) !important; background: var(--info-bg) !important; }
    .st-success { border-left-color: #0d8f72 !important; background: var(--success-bg) !important; }
    .st-neutral { border-left-color: #8d949c !important; background: var(--alt) !important; }
    .st-danger { border-left-color: #c2410c !important; background: var(--danger-bg) !important; }
    .st-muted { border-left-color: #8d949c !important; background: var(--alt) !important; opacity: 0.65; text-decoration: line-through; }

    @media (max-width: 1024px) {
      .sidebar { display: none; }
      .toolbar { padding: 10px 12px; justify-content: center; }
      .stats, .legend { display: contents; }
      .row-break { flex-basis: 100%; height: 0; }
      .spacer { display: none; }
      .add-btn { margin-left: auto; }
    }
  `]
})
export class CalendarComponent implements OnInit {
  view: 'month' | 'week' | 'day' = 'month';
  currentMonth: Date = new Date();
  selectedDate: Date = new Date();
  workOrders: WorkOrder[] = [];
  overdueOrders: WorkOrder[] = [];
  technicians: User[] = [];
  showAll = false;
  overdueCollapsed = false;
  teamCollapsed = false;
  queueCollapsed = false;
  myOverdueCollapsed = false;
  myPendingCollapsed = false;
  filterTech: string | null = null;
  hours = Array.from({ length: 24 }, (_, i) => i);
  showMonthPicker = false;
  pickerYear = new Date().getFullYear();
  private ordersSub?: Subscription;

  constructor(
    private workOrderService: WorkOrderService,
    private userService: UserService,
    public auth: AuthService,
    public i18n: I18nService,
    private scheduleSearch: ScheduleSearchService,
    private toastr: ToastrService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get query(): string {
    return this.scheduleSearch.query;
  }
  set query(value: string) {
    this.scheduleSearch.query = value;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.showMonthPicker && !(event.target as HTMLElement).closest('.period-nav')) {
      this.showMonthPicker = false;
    }
  }

  ngOnInit() {
    this.loadCalendar();
    if (this.auth.isSupervisor) {
      this.userService.getTeamMembers().subscribe({
        next: (list) => { this.technicians = list; this.cdr.detectChanges(); },
        error: (err) => console.error('Error loading team members:', err)
      });
    }
  }

  get dowShortLabels(): string[] {
    return this.i18n.lang === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

  // ตัวกรอง

  get visibleOrders(): WorkOrder[] {
    let list = this.workOrders;
    if (this.filterTech) list = list.filter(o => this.techIdOf(o) === this.filterTech);
    const q = this.query.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        (o.srNumber + o.customerName + o.workType + (o.technician?.fullName || '')).toLowerCase().includes(q));
    }
    return list;
  }

  get pendingApproval(): WorkOrder[] {
    return this.workOrders
      .filter(o => o.status === 'pending_approval')
      .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime());
  }

  // โหมดงานของฉัน workOrders มีแต่งานตัวเองอยู่แล้ว กรองตรงนี้ได้เลย ไม่ต้องเรียก endpoint ของ supervisor
  get myOverdueOrders(): WorkOrder[] {
    return this.workOrders
      .filter(o => o.status === 'overdue')
      .sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0));
  }

  get stats() {
    const list = this.visibleOrders;
    return {
      total: list.length,
      queued: list.filter(o => o.status === 'pending_approval').length
    };
  }

  techHours(techId: string): number {
    return this.workOrders
      .filter(o => this.techIdOf(o) === techId)
      .reduce((a, o) => a + this.durationOf(o), 0);
  }

  toggleTechFilter(techId: string) {
    this.filterTech = this.filterTech === techId ? null : techId;
  }

  clearFilters() {
    this.filterTech = null;
    this.query = '';
    this.toastr.info(this.i18n.t['toastFilterCleared']);
  }

  setScope(all: boolean) {
    this.showAll = all;
    this.filterTech = null;
    this.loadCalendar();
  }

  setView(v: 'month' | 'week' | 'day') {
    this.view = v;
  }

  // การเลื่อนหน้า

  get periodLabel(): string {
    const locale = this.i18n.lang === 'th' ? 'th-TH' : 'en-US';
    if (this.view === 'week') {
      const start = this.weekStart;
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const monthLabel = start.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      return `${start.getDate()}–${end.getDate()} ${monthLabel}`;
    }
    if (this.view === 'day') {
      return this.selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return this.currentMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }

  prevPeriod() {
    if (this.view === 'month') return this.changeMonth(-1);
    this.shiftSelected(this.view === 'week' ? -7 : -1);
  }
  nextPeriod() {
    if (this.view === 'month') return this.changeMonth(1);
    this.shiftSelected(this.view === 'week' ? 7 : 1);
  }
  goToday() {
    const today = new Date();
    this.selectedDate = today;
    this.setCurrentMonth(today);
  }

  private shiftSelected(days: number) {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + days);
    this.selectedDate = d;
    if (d.getMonth() !== this.currentMonth.getMonth() || d.getFullYear() !== this.currentMonth.getFullYear()) {
      this.setCurrentMonth(d);
    }
  }

  private setCurrentMonth(d: Date) {
    this.currentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    this.loadCalendar();
  }

  get monthNames(): string[] {
    const locale = this.i18n.lang === 'th' ? 'th-TH' : 'en-US';
    return Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(locale, { month: 'short' }));
  }

  get pickerYearLabel(): string {
    const locale = this.i18n.lang === 'th' ? 'th-TH' : 'en-US';
    return new Date(this.pickerYear, 0, 1).toLocaleDateString(locale, { year: 'numeric' });
  }

  private get pickerBaseDate(): Date {
    return this.view === 'month' ? this.currentMonth : this.selectedDate;
  }

  toggleMonthPicker() {
    this.showMonthPicker = !this.showMonthPicker;
    if (this.showMonthPicker) {
      this.pickerYear = this.pickerBaseDate.getFullYear();
    }
  }

  isPickerMonthSelected(monthIndex: number): boolean {
    return this.pickerYear === this.pickerBaseDate.getFullYear() && monthIndex === this.pickerBaseDate.getMonth();
  }

  pickMonth(monthIndex: number) {
    const daysInMonth = new Date(this.pickerYear, monthIndex + 1, 0).getDate();
    const day = Math.min(this.selectedDate.getDate(), daysInMonth);
    this.selectedDate = new Date(this.pickerYear, monthIndex, day);
    this.setCurrentMonth(this.selectedDate);
    this.showMonthPicker = false;
  }

  changeMonth(delta: number) {
    if (delta === 0) {
      this.currentMonth = new Date();
    } else {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + delta, 1);
    }
    if (this.selectedDate.getMonth() !== this.currentMonth.getMonth() || this.selectedDate.getFullYear() !== this.currentMonth.getFullYear()) {
      this.selectedDate = new Date(this.currentMonth);
    }
    this.loadCalendar();
  }

  onDayClick(day: { date: Date; isCurrentMonth: boolean }) {
    this.selectedDate = day.date;
    if (!day.isCurrentMonth) {
      this.setCurrentMonth(day.date);
    }
    this.view = 'day';
  }

  // มุมมองรายเดือน

  get calendarDays() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const today = new Date();
    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean; orders: WorkOrder[] }[] = [];

    const prevMonthLast = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast.getDate() - i);
      days.push({ date: d, isCurrentMonth: false, isToday: false, orders: this.ordersOn(d) });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, isToday: this.isSameDay(d, today), orders: this.ordersOn(d) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, isToday: false, orders: this.ordersOn(d) });
    }
    return days;
  }

  // มุมมองรายสัปดาห์

  get weekStart(): Date {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  get weekColumns() {
    const start = this.weekStart;
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, dowLabel: this.dowShortLabels[d.getDay()], isToday: this.isSameDay(d, today), orders: this.ordersOn(d) };
    });
  }

  // มุมมองรายวัน

  get dayRows() {
    const ordersOnDate = this.ordersOn(this.selectedDate);
    if (this.auth.isSupervisor && this.showAll) {
      const source = this.filterTech ? this.technicians.filter(t => t._id === this.filterTech) : this.technicians;
      const rows = source.map(t => {
        const orders = ordersOnDate.filter(o => this.techIdOf(o) === t._id);
        const hrs = orders.reduce((a, o) => a + this.durationOf(o), 0);
        return { techId: t._id, name: t.fullName, hoursLabel: hrs ? `${hrs} ${this.i18n.t['hoursUnit']}` : '', orders };
      });
      // งานอาจถูกมอบหมายให้ supervisor หรือ admin เอง ซึ่งไม่อยู่ในรายชื่อช่าง
      // เลยเพิ่มแถวให้ผู้รับงานคนอื่นๆ ด้วย กันไม่ให้งานหายไปเงียบๆ
      const knownIds = new Set(rows.map(r => r.techId));
      const extraIds = Array.from(new Set(
        ordersOnDate.map(o => this.techIdOf(o)).filter((id): id is string => !!id && !knownIds.has(id))
      ));
      if (!this.filterTech) {
        for (const id of extraIds) {
          const orders = ordersOnDate.filter(o => this.techIdOf(o) === id);
          const hrs = orders.reduce((a, o) => a + this.durationOf(o), 0);
          const name = orders[0]?.technician?.fullName || id;
          rows.push({ techId: id, name, hoursLabel: hrs ? `${hrs} ${this.i18n.t['hoursUnit']}` : '', orders });
        }
      }
      return rows;
    }
    const me = this.auth.currentUser;
    return me ? [{ techId: me._id, name: me.fullName, hoursLabel: '', orders: ordersOnDate }] : [];
  }

  blockLeft(order: WorkOrder): string {
    return `${(this.startOf(order) / 24 * 100).toFixed(2)}%`;
  }
  blockWidth(order: WorkOrder): string {
    const start = this.startOf(order);
    const dur = Math.min(this.durationOf(order), 24 - start);
    return `${(dur / 24 * 100).toFixed(2)}%`;
  }

  // ฟังก์ชันช่วย

  private ordersOn(d: Date): WorkOrder[] {
    return this.visibleOrders
      .filter(o => this.isSameDay(this.calendarDayOf(o.plannedDate), d))
      .sort((a, b) => this.startOf(a) - this.startOf(b));
  }

  // plannedDate เก็บเป็น UTC midnight แปลงเป็น local midnight ก่อนเทียบวันในปฏิทิน กันเพี้ยนข้าม timezone
  private calendarDayOf(value: string | Date): Date {
    const raw = new Date(value);
    return new Date(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate());
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

  private startOf(order: WorkOrder): number {
    return this.parseTime(order.plannedStartTime) ?? 9;
  }

  private durationOf(order: WorkOrder): number {
    const start = this.parseTime(order.plannedStartTime);
    const end = this.parseTime(order.plannedEndTime);
    if (start != null && end != null && end > start) return Math.round((end - start) * 10) / 10;
    return 1;
  }

  timeWindow(order: WorkOrder): string {
    return `${order.plannedStartTime || '--:--'} - ${order.plannedEndTime || '--:--'}`;
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
      case 'completed':
        return 'st-success';
      case 'overdue':
        return 'st-danger';
      case 'cancelled':
        return 'st-muted';
      default:
        return 'st-neutral';
    }
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
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
    return CalendarComponent.AVATAR_PALETTE[hash % CalendarComponent.AVATAR_PALETTE.length];
  }

  viewOrder(id: string) {
    this.router.navigate(['/work-orders', id]);
  }

  addNewWork() {
    this.router.navigate(['/work-orders/new']);
  }
}
