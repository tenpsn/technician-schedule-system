import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { AuditChange, AuditLog, AuditLogService } from '../../services/audit-log.service';
import { I18nService } from '../../services/i18n.service';

// ชื่อช่องในประวัติ แปลงเป็น key คำแปลที่หน้าสัญญากับหน้ารายชื่อโรงพยาบาลใช้อยู่แล้ว
const FIELD_LABEL_KEY: Record<string, string> = {
  name: 'hospitalName', address: 'hospitalAddress', facilityCode: 'hospitalFacilityCode',
  hospital: 'hospitalName', contractNumber: 'contractNumber', startDate: 'contractStart', endDate: 'contractEnd',
  maIntervalMonths: 'contractMaInterval', maVisitDate: 'contractVisitDate', maVisitTechnician: 'contractVisitTech'
};
const DATE_FIELDS = ['startDate', 'endDate', 'maVisitDate'];

@Component({
  selector: 'app-audit-log',
  standalone: false,
  template: `
    <div class="page">
      <div class="card">
        <div class="card-head">
          <div class="head-title">{{ i18n.t['auditHistory'] }}</div>
          <button (click)="back()" class="btn-ghost">← {{ i18n.t['back'] }}</button>
        </div>

        <div class="search-bar">
          <div class="type-tabs">
            <button *ngFor="let t of types" type="button" [class.on]="entityType === t.value" (click)="setType(t.value)">{{ i18n.t[t.key] }}</button>
          </div>
          <div class="search-box">
            <span>⌕</span>
            <input type="text" [(ngModel)]="searchText" [placeholder]="i18n.t['auditSearchPh']" (ngModelChange)="onSearchChange()">
          </div>
          <span class="mono count">{{ i18n.t['allOf'] }} {{ total }}</span>
        </div>

        <div *ngIf="loading" class="empty-state">{{ i18n.t['loading'] }}</div>

        <div *ngIf="!loading" class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-time">{{ i18n.t['auditColTime'] }}</th>
                <th>{{ i18n.t['auditColActor'] }}</th>
                <th>{{ i18n.t['auditColAction'] }}</th>
                <th>{{ i18n.t['auditColItem'] }}</th>
                <th>{{ i18n.t['auditColChanges'] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of logs">
                <td class="mono muted nowrap">{{ log.createdAt | localDate:'dd/MM/yyyy HH:mm' }}</td>
                <td class="nowrap">{{ log.actorName || '—' }}</td>
                <td><span class="action-pill" [ngClass]="'act-' + log.action">{{ actionLabel(log.action) }}</span></td>
                <td>
                  <div class="item-type">{{ log.entityType === 'hospital' ? i18n.t['auditTypeHospital'] : i18n.t['auditTypeContract'] }}</div>
                  <div>{{ log.entityLabel }}</div>
                </td>
                <td class="changes">
                  <div *ngFor="let c of log.changes">{{ changeText(log, c) }}</div>
                </td>
              </tr>
              <tr *ngIf="logs.length === 0">
                <td colspan="5" class="empty-cell">{{ i18n.t['auditEmpty'] }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-bar" *ngIf="total > pageSize">
          <button type="button" class="btn-page" [disabled]="currentPage === 1" (click)="goToPage(1)">{{ i18n.t['pageFirst'] }}</button>
          <button type="button" class="btn-page" [disabled]="currentPage === 1" (click)="goToPage(currentPage - 1)">{{ i18n.t['pagePrev'] }}</button>
          <span class="page-jump">
            <input type="number" min="1" [max]="totalPages" [ngModel]="currentPage" (ngModelChange)="goToPage($event)" class="page-input">
            <span class="muted">/ {{ totalPages }}</span>
          </span>
          <button type="button" class="btn-page" [disabled]="currentPage === totalPages" (click)="goToPage(currentPage + 1)">{{ i18n.t['next'] }}</button>
          <button type="button" class="btn-page" [disabled]="currentPage === totalPages" (click)="goToPage(totalPages)">{{ i18n.t['pageLast'] }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 18px 44px; max-width: 1100px; margin: 0 auto; }
    .card { border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line2); }
    .head-title { font-size: 18px; font-weight: 700; }
    .btn-ghost { border-radius: var(--radius); height: 40px; padding: 0 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    .search-bar { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--line2); flex-wrap: wrap; }
    .type-tabs { display: flex; border-radius: var(--radius); border: 1px solid var(--line); overflow: hidden; flex: none; }
    .type-tabs button { height: 42px; padding: 0 14px; border: none; border-right: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; cursor: pointer; }
    .type-tabs button:last-child { border-right: none; }
    .type-tabs button.on { background: var(--accent); color: #fff; }
    .search-box { border-radius: var(--radius); flex: 1 1 240px; display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 12px; border: 1px solid var(--line); background: var(--field); }
    .search-box span { color: var(--sub); font-size: 13px; }
    .search-box input { border: none; background: transparent; outline: none; font-size: 13.5px; width: 100%; color: var(--ink); }
    .count { font-size: 12.5px; color: var(--sub); }

    .empty-state { text-align: center; padding: 40px 20px; color: var(--sub); }
    .table-scroll { overflow-x: auto; }
    .data-table { width: 100%; min-width: 760px; border-collapse: collapse; }
    .data-table th { background: var(--alt); color: var(--sub); border-bottom: 2px solid var(--accent); text-align: left; padding: 11px 16px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid var(--line2); font-size: 13.5px; vertical-align: top; }
    .col-time { width: 140px; }
    .muted { color: var(--sub); }
    .nowrap { white-space: nowrap; }
    .item-type { font-size: 11.5px; color: var(--sub); }
    .changes { font-size: 12.5px; line-height: 1.6; }
    .empty-cell { text-align: center; color: var(--sub); padding: 30px; }
    .action-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid var(--line); white-space: nowrap; }
    .act-create { background: var(--info-bg); color: var(--info-text); border-color: var(--info-line); }
    .act-update { background: var(--warn-bg); color: var(--warn-text); border-color: var(--warn-line); }
    .act-delete { background: var(--danger-bg); color: var(--danger-text); border-color: var(--danger-line); }

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
  `]
})
export class AuditLogComponent implements OnInit, OnDestroy {
  logs: AuditLog[] = [];
  total = 0;
  loading = false;
  pageSize = 10;
  currentPage = 1;
  entityType = '';
  searchText = '';
  types = [
    { value: '', key: 'auditTypeAll' },
    { value: 'hospital', key: 'auditTypeHospital' },
    { value: 'contract', key: 'auditTypeContract' }
  ];
  private searchTimer: any;

  constructor(
    private auditLogService: AuditLogService,
    public i18n: I18nService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.load();
  }

  ngOnDestroy() {
    clearTimeout(this.searchTimer);
  }

  load() {
    this.loading = true;
    this.auditLogService.list({
      page: this.currentPage, pageSize: this.pageSize, entityType: this.entityType, search: this.searchText.trim()
    }).subscribe({
      next: (res) => {
        this.logs = res.items;
        this.total = res.total;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(this.i18n.errorMessage(err));
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  goToPage(page: number) {
    const target = Math.min(Math.max(1, Math.floor(page) || 1), this.totalPages);
    if (target === this.currentPage) return;
    this.currentPage = target;
    this.load();
  }

  setType(type: string) {
    this.entityType = type;
    this.currentPage = 1;
    this.load();
  }

  // รอให้พิมพ์จบก่อนค่อยค้น ไม่ยิงไป server ทุกตัวอักษร
  onSearchChange() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.load();
    }, 350);
  }

  actionLabel(action: string): string {
    const key = { create: 'auditActionCreate', update: 'auditActionUpdate', delete: 'auditActionDelete' }[action];
    return key ? this.i18n.t[key] : action;
  }

  // ตอนเพิ่มแสดงแค่ค่าใหม่ ตอนลบแสดงแค่ค่าเดิม ตอนแก้ไขแสดงค่าเดิมกับค่าใหม่
  changeText(log: AuditLog, c: AuditChange): string {
    let label = this.i18n.t[FIELD_LABEL_KEY[c.field]] || c.field;
    if (c.seq) label += ` (${this.i18n.t['contractVisitSeq']} ${c.seq})`;
    if (log.action === 'create') return `${label}: ${this.formatValue(c.field, c.to)}`;
    if (log.action === 'delete') return `${label}: ${this.formatValue(c.field, c.from)}`;
    return `${label}: ${this.formatValue(c.field, c.from)} → ${this.formatValue(c.field, c.to)}`;
  }

  private formatValue(field: string, value: string | number | null): string {
    if (value === null || value === '') return '-';
    if (DATE_FIELDS.includes(field)) return this.i18n.formatDateOnly(String(value));
    if (field === 'maIntervalMonths') return `${value} ${this.i18n.t['contractMaIntervalSuffix']}`;
    return String(value);
  }

  back() {
    window.history.back();
  }
}
