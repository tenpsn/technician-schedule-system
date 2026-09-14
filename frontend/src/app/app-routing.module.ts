import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { WorkOrderFormComponent } from './components/work-order-form/work-order-form.component';
import { WorkOrderDetailComponent } from './components/work-order-detail/work-order-detail.component';
import { CancelledOrdersComponent } from './components/cancelled-orders/cancelled-orders.component';
import { HospitalSettingsComponent } from './components/hospital-settings/hospital-settings.component';
import { UserSettingsComponent } from './components/user-settings/user-settings.component';
import { ProfileComponent } from './components/profile/profile.component';
import { authGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/calendar', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'calendar', component: CalendarComponent, canActivate: [authGuard] },
  { path: 'work-orders/new', component: WorkOrderFormComponent, canActivate: [authGuard] },
  { path: 'work-orders/:id', component: WorkOrderDetailComponent, canActivate: [authGuard] },
  { path: 'cancelled-orders', component: CancelledOrdersComponent, canActivate: [authGuard] },
  { path: 'settings/hospitals', component: HospitalSettingsComponent, canActivate: [authGuard] },
  { path: 'settings/users', component: UserSettingsComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
