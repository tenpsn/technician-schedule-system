import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { I18nService } from './services/i18n.service';
import { ScheduleSearchService } from './services/schedule-search.service';
import { NotificationService, AppNotification } from './services/notification.service';
import { NavigationEnd, Router } from '@angular/router';

const NOTIF_POLL_MS = 30000;

@Component({
  selector: 'app-root',
  standalone: false,
  template: `
    <div class="shell">
      <header class="topbar" *ngIf="auth.isAuthenticated">
        <div class="brand">
          <div class="brand-name">{{ i18n.t['brand'] }}</div>
          <div class="brand-sub mono">SERVICE DISPATCH</div>
        </div>

        <nav class="top-nav">
          <a routerLink="/calendar" routerLinkActive="active">{{ auth.isSupervisor ? i18n.t['navSchedule'] : i18n.t['navMySchedule'] }}</a>
          <div class="nav-dropdown">
            <button class="nav-dropdown-toggle" [class.active]="currentUrl.startsWith('/work-orders/new') || currentUrl.startsWith('/cancelled-orders')" (click)="toggleJobsMenu()">{{ i18n.t['navJobs'] }}</button>
            <div class="nav-dropdown-menu" *ngIf="showJobsMenu">
              <button class="nav-dropdown-item" (click)="goToAddWork()">{{ i18n.t['navAdd'] }}</button>
              <button class="nav-dropdown-item" (click)="goToCancelledOrders()">{{ i18n.t['navCancelled'] }}</button>
            </div>
          </div>
          <a *ngIf="auth.isSupervisor" routerLink="/dashboard" routerLinkActive="active">{{ i18n.t['navDashboard'] }}</a>
          <div class="nav-dropdown" *ngIf="auth.isSupervisor">
            <button class="nav-dropdown-toggle" [class.active]="currentUrl.startsWith('/settings/hospitals') || currentUrl.startsWith('/settings/contracts')" (click)="toggleCustomerMenu()">{{ i18n.t['navHospitals'] }}</button>
            <div class="nav-dropdown-menu" *ngIf="showCustomerMenu">
              <button class="nav-dropdown-item" (click)="goToContracts()">{{ i18n.t['contractSettings'] }}</button>
              <button class="nav-dropdown-item" (click)="goToHospitalSettings()">{{ i18n.t['hospitalSettings'] }}</button>
            </div>
          </div>
          <a *ngIf="auth.isAdmin" routerLink="/settings/users" routerLinkActive="active">{{ i18n.t['navUsers'] }}</a>
        </nav>

        <div class="spacer"></div>

        <div class="search-box" *ngIf="showScheduleSearch">
          <span>⌕</span>
          <input [(ngModel)]="scheduleSearch.query" [placeholder]="i18n.t['searchPh']">
        </div>

        <div class="user-menu-wrap">
          <button class="user-chip" (click)="toggleUserMenu()" [title]="i18n.t['myProfile']">
            <div class="avatar">{{ initials(auth.currentUser?.fullName) }}</div>
            <div class="user-meta">
              <div class="user-name">{{ auth.currentUser?.fullName }}</div>
              <div class="user-role">{{ i18n.roleLabel(auth.currentUser?.role || '') }}</div>
            </div>
          </button>

          <div class="user-menu" *ngIf="showUserMenu">
            <a class="user-menu-item" routerLink="/profile" routerLinkActive="active" (click)="showUserMenu = false">
              <span class="user-menu-icon">👤</span>{{ i18n.t['myProfile'] }}
            </a>
            <button class="user-menu-item danger" (click)="showUserMenu = false; confirmLogout()">
              <span class="user-menu-icon">⎋</span>{{ i18n.t['logout'] }}
            </button>
          </div>
        </div>

        <button class="theme-btn" (click)="theme.toggle()" [title]="i18n.t['themeBtn']">{{ theme.glyph }}</button>

        <div class="lang-switch">
          <button [class.on]="i18n.lang === 'th'" (click)="i18n.set('th')">TH</button>
          <button [class.on]="i18n.lang === 'en'" (click)="i18n.set('en')">EN</button>
        </div>

        <div class="notif-wrap">
          <button class="bell-btn" (click)="toggleNotifications()" [title]="i18n.t['notifications']">
            🔔
            <span class="badge" *ngIf="unreadCount > 0">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
          </button>

          <div class="notif-panel" *ngIf="showNotifications">
            <div class="notif-head">
              <span>{{ i18n.t['notifications'] }}</span>
              <button class="link-btn" *ngIf="unreadCount > 0" (click)="onMarkAllRead()">{{ i18n.t['markAllRead'] }}</button>
            </div>
            <div class="notif-list">
              <div class="notif-item" *ngFor="let n of notifications" [class.unread]="!n.isRead" (click)="openNotification(n)">
                <div class="notif-title">{{ n.title }}</div>
                <div class="notif-message">{{ n.message }}</div>
                <div class="notif-time mono">{{ n.createdAt | localDate:'dd/MM/yyyy HH:mm' }}</div>
              </div>
              <div class="notif-empty" *ngIf="notifications.length === 0">{{ i18n.t['noNotifications'] }}</div>
            </div>
          </div>
        </div>
      </header>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      <nav class="bottom-nav" *ngIf="auth.isAuthenticated">
        <a routerLink="/calendar" routerLinkActive="active">
          <span class="glyph">▦</span><span class="label">{{ auth.isSupervisor ? i18n.t['navSchedule'] : i18n.t['navMySchedule'] }}</span>
        </a>
        <div class="bottom-nav-dropdown">
          <button class="bottom-nav-toggle" [class.active]="currentUrl.startsWith('/work-orders/new') || currentUrl.startsWith('/cancelled-orders')" (click)="toggleJobsMenu()">
            <span class="glyph">✚</span><span class="label">{{ i18n.t['navJobs'] }}</span>
          </button>
          <div class="bottom-nav-menu" *ngIf="showJobsMenu">
            <button class="bottom-nav-menu-item" (click)="goToAddWork()">{{ i18n.t['navAdd'] }}</button>
            <button class="bottom-nav-menu-item" (click)="goToCancelledOrders()">{{ i18n.t['navCancelled'] }}</button>
          </div>
        </div>
        <a *ngIf="auth.isSupervisor" routerLink="/dashboard" routerLinkActive="active">
          <span class="glyph">▤</span><span class="label">{{ i18n.t['navDashboard'] }}</span>
        </a>
        <div class="bottom-nav-dropdown" *ngIf="auth.isSupervisor">
          <button class="bottom-nav-toggle" [class.active]="currentUrl.startsWith('/settings/hospitals') || currentUrl.startsWith('/settings/contracts')" (click)="toggleCustomerMenu()">
            <span class="glyph">⌂</span><span class="label">{{ i18n.t['navHospitals'] }}</span>
          </button>
          <div class="bottom-nav-menu" *ngIf="showCustomerMenu">
            <button class="bottom-nav-menu-item" (click)="goToContracts()">{{ i18n.t['contractSettings'] }}</button>
            <button class="bottom-nav-menu-item" (click)="goToHospitalSettings()">{{ i18n.t['hospitalSettings'] }}</button>
          </div>
        </div>
        <a *ngIf="auth.isAdmin" routerLink="/settings/users" routerLinkActive="active">
          <span class="glyph">👤</span><span class="label">{{ i18n.t['navUsers'] }}</span>
        </a>
      </nav>

      <div *ngIf="showLogoutConfirm" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-title">{{ i18n.t['logoutTitle'] }}</div>
          <div class="modal-body">{{ i18n.t['logoutBody'] }}</div>
          <div class="modal-user">
            <div class="avatar">{{ initials(auth.currentUser?.fullName) }}</div>
            <div>
              <div class="user-name">{{ auth.currentUser?.fullName }}</div>
              <div class="user-role">{{ i18n.roleLabel(auth.currentUser?.role || '') }}</div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-danger" (click)="logout()">{{ i18n.t['logoutConfirm'] }}</button>
            <button class="btn-ghost" (click)="showLogoutConfirm = false">{{ i18n.t['stayIn'] }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; display: flex; flex-direction: column; }
    .main-content { flex: 1; min-height: 0; }

    .topbar {
      display: flex; align-items: center; flex-wrap: wrap; row-gap: 8px; column-gap: 14px;
      padding: 9px 18px; min-height: 62px; position: relative;
      background: var(--chrome); color: var(--chrome-ink);
    }
    .brand { flex: none; }
    .brand-name { font-size: 15.5px; font-weight: 700; }
    .brand-sub { font-size: 10px; letter-spacing: 0.16em; color: var(--chrome-sub); }

    .top-nav { display: flex; border-radius: var(--radius); border: 1px solid var(--chrome-line); flex: none; }
    .top-nav > a:first-child, .top-nav > .nav-dropdown:first-child .nav-dropdown-toggle {
      border-top-left-radius: var(--radius); border-bottom-left-radius: var(--radius);
    }
    .top-nav > a:last-child, .top-nav > .nav-dropdown:last-child .nav-dropdown-toggle {
      border-top-right-radius: var(--radius); border-bottom-right-radius: var(--radius);
    }
    .top-nav a {
      height: 40px; padding: 0 15px; display: flex; align-items: center;
      border-right: 1px solid var(--chrome-line); color: var(--chrome-ink);
      font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer;
    }
    .top-nav a:last-child { border-right: none; }
    .top-nav a:hover { filter: brightness(1.15); text-decoration: none; }
    .top-nav a.active { background: var(--accent); color: #fff; }

    .nav-dropdown { position: relative; }
    .nav-dropdown-toggle {
      height: 40px; padding: 0 15px; display: flex; align-items: center;
      border: none; border-right: 1px solid var(--chrome-line); background: transparent;
      color: var(--chrome-ink); font-size: 13px; font-weight: 600; font-family: inherit;
      text-decoration: none; cursor: pointer;
    }
    .nav-dropdown:last-child .nav-dropdown-toggle { border-right: none; }
    .nav-dropdown-toggle:hover { filter: brightness(1.15); }
    .nav-dropdown-toggle.active { background: var(--accent); color: #fff; }
    .nav-dropdown-menu {
      position: absolute; top: calc(100% + 12px); left: 0; z-index: 30; min-width: 220px;
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 6px;
      box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26); animation: modalIn .16s ease both; overflow: hidden;
    }
    .nav-dropdown-item {
      display: flex; align-items: center; width: 100%; padding: 10px 12px;
      border-radius: 8px; border: none; background: transparent; color: var(--ink);
      font-size: 13.5px; font-weight: 600; text-decoration: none; cursor: pointer;
      text-align: left; font-family: inherit;
    }
    .nav-dropdown-item:hover { background: var(--alt); }

    .spacer { flex: 1; min-width: 8px; }

    .search-box {
      border-radius: var(--radius); display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px;
      flex: 0 1 240px; min-width: 160px; background: var(--chrome-alt); border: 1px solid var(--chrome-line);
    }
    .search-box span { color: var(--chrome-sub); font-size: 14px; }
    .search-box input { border: none; background: transparent; outline: none; font-size: 13px; color: var(--chrome-ink); width: 100%; }

    .lang-switch { display: flex; border-radius: var(--radius); border: 1px solid var(--chrome-line); overflow: hidden; flex: none; }
    .lang-switch button {
      height: 40px; padding: 0 12px; border: none; border-right: 1px solid var(--chrome-line);
      background: transparent; color: var(--chrome-ink); font-family: 'IBM Plex Mono', monospace;
      font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .lang-switch button:last-child { border-right: none; }
    .lang-switch button.on { background: var(--accent); color: #fff; }

    .theme-btn {
      height: 40px; width: 40px; border-radius: var(--radius); border: 1px solid var(--chrome-line);
      background: transparent; color: var(--chrome-ink); font-size: 15px; cursor: pointer; flex: none;
    }
    .theme-btn:hover { border-color: var(--accent); color: var(--accent); }

    .notif-wrap { position: relative; flex: none; }
    .bell-btn {
      height: 40px; width: 40px; border-radius: var(--radius); border: 1px solid var(--chrome-line);
      background: transparent; color: var(--chrome-ink); font-size: 15px; cursor: pointer; position: relative;
    }
    .bell-btn:hover { border-color: var(--accent); }
    .badge {
      position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px;
      border-radius: 999px; background: #d94a20; color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; line-height: 1;
    }

    .notif-panel {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; width: 340px; max-width: calc(100vw - 36px);
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26); animation: modalIn .16s ease both; overflow: hidden;
    }
    .notif-head {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 12px 14px; border-bottom: 1px solid var(--line2); font-size: 13.5px; font-weight: 700; color: var(--ink);
    }
    .link-btn { border: none; background: transparent; color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer; }
    .link-btn:hover { text-decoration: underline; }

    .notif-list { max-height: 360px; overflow-y: auto; scrollbar-gutter: stable; }
    .notif-item { padding: 11px 14px; border-bottom: 1px solid var(--line2); cursor: pointer; }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: var(--alt); }
    .notif-item.unread { background: var(--info-bg); }
    .notif-title { font-size: 13px; font-weight: 700; color: var(--ink); }
    .notif-message { font-size: 12.5px; color: var(--sub); margin-top: 3px; white-space: pre-line; line-height: 1.5; }
    .notif-time { font-size: 11px; color: var(--sub); margin-top: 6px; }
    .notif-empty { padding: 30px 14px; text-align: center; color: var(--sub); font-size: 13px; }

    .user-menu-wrap { position: relative; flex: none; }
    .user-chip {
      display: flex; align-items: center; gap: 10px; width: 100%; cursor: pointer;
      border-radius: var(--radius); padding: 4px 8px; margin: -4px -8px;
      text-decoration: none; color: inherit; border: 1px solid transparent;
      background: transparent; font-family: inherit; text-align: left;
    }
    .user-chip:hover { background: var(--chrome-alt); text-decoration: none; }
    .avatar {
      border-radius: 8px; width: 34px; height: 34px; flex: none;
      background: var(--accent); color: #fff; display: grid; place-items: center;
      font-size: 12px; font-weight: 700;
    }
    .user-meta { min-width: 0; max-width: 140px; }
    .user-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { font-size: 11px; color: var(--chrome-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .user-menu {
      position: absolute; top: calc(100% + 12px); z-index: 30; width: 200px; max-width: calc(100vw - 36px);
      background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 6px;
      box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26); animation: modalIn .16s ease both; overflow: hidden;
    }
    .user-menu-item {
      display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px;
      border-radius: 8px; border: none; background: transparent; color: var(--ink);
      font-size: 13.5px; font-weight: 600; text-decoration: none; cursor: pointer;
      text-align: left; font-family: inherit;
    }
    .user-menu-item:hover { background: var(--alt); text-decoration: none; }
    .user-menu-item.danger { color: var(--danger-text); }
    .user-menu-icon { font-size: 15px; flex: none; width: 18px; text-align: center; }

    .bottom-nav { display: none; }

    .modal-overlay {
      position: fixed; inset: 0; z-index: 30; background: rgba(8, 9, 11, 0.62);
      display: flex; align-items: center; justify-content: center; padding: 18px;
      animation: veilIn .16s ease both;
    }
    .modal-card {
      border-radius: 16px; width: 100%; max-width: 440px;
      background: var(--surface); border: 1px solid var(--line); padding: 24px; color: var(--ink);
      animation: modalIn .2s ease backwards;
    }
    .modal-title { font-size: 19px; font-weight: 700; }
    .modal-body { font-size: 14px; color: var(--sub); line-height: 1.65; margin-top: 10px; }
    .modal-user {
      border-radius: var(--radius); display: flex; align-items: center; gap: 11px; margin-top: 18px;
      padding: 12px 14px; background: var(--alt); border: 1px solid var(--line2);
    }
    .modal-actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
    .modal-actions button { flex: 1 1 150px; height: 50px; border-radius: var(--radius); font-size: 14px; font-weight: 700; cursor: pointer; }
    .btn-danger { border: 1px solid #a5320c; background: #d94a20; color: #fff; }
    .btn-danger:hover { filter: brightness(1.05); }
    .btn-ghost { border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

    @media (max-width: 768px) {
      .top-nav { display: none; }
      .spacer { display: none; }
      .topbar { padding: 13px 14px 15px; justify-content: flex-end; }
      .brand { flex: 1 1 100%; order: -1; }
      .search-box { flex: 1 1 100%; }
      .user-menu-wrap { margin-right: auto; }

      .main-content { padding-bottom: 80px; }
      .bottom-nav {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; height: 72px;
        background: var(--surface); border-top: 1px solid var(--line); display: flex;
      }
      .bottom-nav a {
        flex: 1; border: none; border-top: 3px solid transparent; background: transparent;
        display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
        gap: 4px; text-decoration: none; color: var(--sub); padding-top: 13px;
      }
      .bottom-nav a .glyph { font-size: 18px; }
      .bottom-nav a .label { font-size: 11px; font-weight: 600; text-align: center; }
      .bottom-nav a.active { color: var(--accent); border-top-color: var(--accent); }

      .bottom-nav-dropdown { position: relative; flex: 1; display: flex; }
      .bottom-nav-toggle {
        flex: 1; border: none; border-top: 3px solid transparent; background: transparent;
        display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
        gap: 4px; color: var(--sub); padding-top: 13px; font-family: inherit; cursor: pointer;
      }
      .bottom-nav-toggle .glyph { font-size: 18px; }
      .bottom-nav-toggle .label { font-size: 11px; font-weight: 600; text-align: center; }
      .bottom-nav-toggle.active { color: var(--accent); border-top-color: var(--accent); }
      .bottom-nav-menu {
        position: fixed; bottom: 82px; left: 50%; margin-left: -110px;
        width: 220px; max-width: calc(100vw - 24px); background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
        padding: 6px; box-shadow: 0 12px 30px rgba(8, 9, 11, 0.26); animation: modalIn .16s ease both; z-index: 7;
      }
      .bottom-nav-menu-item {
        display: block; width: 100%; padding: 10px 12px; border-radius: 8px; border: none;
        background: transparent; color: var(--ink); font-size: 13px; font-weight: 600;
        text-decoration: none; white-space: nowrap; text-align: center; font-family: inherit; cursor: pointer;
      }
      .bottom-nav-menu-item:hover { background: var(--alt); }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  showLogoutConfirm = false;
  showNotifications = false;
  showUserMenu = false;
  showCustomerMenu = false;
  showJobsMenu = false;
  notifications: AppNotification[] = [];
  unreadCount = 0;
  currentUrl: string;
  private pollHandle: any;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    public i18n: I18nService,
    public scheduleSearch: ScheduleSearchService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.currentUrl = this.router.url;
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) this.currentUrl = event.urlAfterRedirects;
    });
  }

  ngOnInit() {
    setTimeout(() => this.refreshUnreadCount());
    this.pollHandle = setInterval(() => this.refreshUnreadCount(), NOTIF_POLL_MS);
  }

  ngOnDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.showNotifications && !target.closest('.notif-wrap')) {
      this.showNotifications = false;
    }
    if (this.showUserMenu && !target.closest('.user-menu-wrap')) {
      this.showUserMenu = false;
    }
    if (this.showCustomerMenu && !target.closest('.nav-dropdown') && !target.closest('.bottom-nav-dropdown')) {
      this.showCustomerMenu = false;
    }
    if (this.showJobsMenu && !target.closest('.nav-dropdown') && !target.closest('.bottom-nav-dropdown')) {
      this.showJobsMenu = false;
    }
  }

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
    if (this.showUserMenu) this.showNotifications = false;
  }

  toggleCustomerMenu() {
    this.showCustomerMenu = !this.showCustomerMenu;
    if (this.showCustomerMenu) {
      this.showUserMenu = false;
      this.showNotifications = false;
      this.showJobsMenu = false;
    }
  }

  toggleJobsMenu() {
    this.showJobsMenu = !this.showJobsMenu;
    if (this.showJobsMenu) {
      this.showUserMenu = false;
      this.showNotifications = false;
      this.showCustomerMenu = false;
    }
  }

  goToHospitalSettings() {
    this.showCustomerMenu = false;
    this.router.navigate(['/settings/hospitals']);
  }

  goToContracts() {
    this.showCustomerMenu = false;
    this.router.navigate(['/settings/contracts']);
  }

  goToAddWork() {
    this.showJobsMenu = false;
    this.router.navigate(['/work-orders/new']);
  }

  goToCancelledOrders() {
    this.showJobsMenu = false;
    this.router.navigate(['/cancelled-orders']);
  }

  get showScheduleSearch(): boolean {
    return this.currentUrl.startsWith('/calendar');
  }

  initials(name?: string): string {
    if (!name) return '';
    return name.replace(/\s+/g, ' ').split(' ')[0].slice(0, 2);
  }

  private refreshUnreadCount() {
    if (!this.auth.isAuthenticated) return;
    this.notificationService.unreadCount().subscribe({
      next: (res) => { this.unreadCount = res.count; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.showUserMenu = false;
      this.notificationService.list().subscribe({
        next: (list) => { this.notifications = list; this.cdr.detectChanges(); },
        error: () => {}
      });
    }
  }

  openNotification(n: AppNotification) {
    if (!n.isRead) {
      n.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.notificationService.markRead(n._id).subscribe({ error: () => {} });
    }
    this.showNotifications = false;
    if (n.relatedWorkOrder?._id) {
      this.router.navigate(['/work-orders', n.relatedWorkOrder._id]);
    }
  }

  onMarkAllRead() {
    this.notifications.forEach(n => (n.isRead = true));
    this.unreadCount = 0;
    this.notificationService.markAllRead().subscribe({ error: () => {} });
  }

  confirmLogout() {
    this.showLogoutConfirm = true;
  }

  logout() {
    this.showLogoutConfirm = false;
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
