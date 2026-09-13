import { Component } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: false,
  template: `
    <div class="app-container">
      <nav class="navbar" *ngIf="auth.isAuthenticated">
        <div class="nav-brand">
          <h3>🔧 ระบบจัดการงานช่าง</h3>
        </div>
        <div class="nav-links">
          <a routerLink="/calendar" routerLinkActive="active">📅 ตารางงาน</a>
          <a routerLink="/work-orders/new" routerLinkActive="active">➕ เพิ่มงาน</a>
          <a *ngIf="auth.isSupervisor" routerLink="/cancelled-orders" routerLinkActive="active"> งานที่ยกเลิก</a>
          <a *ngIf="auth.isSupervisor" routerLink="/settings/hospitals" routerLinkActive="active">⚙️ ตั้งค่าโรงพยาบาล</a>
        </div>
        <div class="nav-user">
          <span class="user-info">{{ auth.currentUser?.fullName }}</span>
          <button (click)="confirmLogout()" class="btn-logout"> ออก</button>
        </div>
      </nav>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>

      <div *ngIf="showLogoutConfirm" class="modal">
        <div class="modal-content">
          <h3>ออกจากระบบ?</h3>
          <p>ต้องการออกจากระบบใช่หรือไม่</p>
          <div class="modal-actions">
            <button (click)="logout()" class="btn-confirm">✅ ออกจากระบบ</button>
            <button (click)="showLogoutConfirm = false" class="btn-cancel-modal">❌ ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .app-container { min-height: 100vh; background: #f5f5f5; }
    .navbar { 
      background: #1976d2; color: white; padding: 15px 30px; 
      display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .nav-brand h3 { margin: 0; font-size: 20px; }
    .nav-links { display: flex; gap: 20px; }
    .nav-links a { 
      color: white; text-decoration: none; padding: 8px 16px; 
      border-radius: 4px; transition: background 0.2s;
    }
    .nav-links a:hover, .nav-links a.active { background: rgba(255,255,255,0.2); }
    .nav-user { display: flex; align-items: center; gap: 15px; }
    .user-info { font-size: 14px; }
    .btn-logout { 
      padding: 8px 16px; border: 1px solid white; background: transparent; 
      color: white; border-radius: 4px; cursor: pointer; transition: all 0.2s;
    }
    .btn-logout:hover { background: white; color: #1976d2; }
    .main-content { padding: 20px; }
    
    @media (max-width: 768px) {
      .navbar { flex-direction: column; gap: 15px; padding: 15px; }
      .nav-links { flex-wrap: wrap; justify-content: center; }
    }

    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; max-width: 400px; width: 100%; }
    .modal-content h3 { margin: 0 0 15px 0; color: #333; }
    .modal-content p { margin: 0; color: #555; }
    .modal-actions { display: flex; gap: 10px; margin-top: 25px; }
    .modal-actions button { flex: 1; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; }
    .btn-confirm { background: #f44336; color: white; }
    .btn-cancel-modal { background: #f5f5f5; color: #333; }
    .btn-confirm:hover, .btn-cancel-modal:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
  `]
})
export class AppComponent {
  showLogoutConfirm = false;

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  confirmLogout() {
    this.showLogoutConfirm = true;
  }

  logout() {
    this.showLogoutConfirm = false;
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
