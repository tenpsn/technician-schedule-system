import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ToastrModule } from 'ngx-toastr';
import 'ngx-toastr/toastr';
import { AuthInterceptor } from './interceptors/auth.interceptor';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { WorkOrderFormComponent } from './components/work-order-form/work-order-form.component';
import { WorkOrderDetailComponent } from './components/work-order-detail/work-order-detail.component';
import { CancelledOrdersComponent } from './components/cancelled-orders/cancelled-orders.component';
import { HospitalSettingsComponent } from './components/hospital-settings/hospital-settings.component';
import { UserSettingsComponent } from './components/user-settings/user-settings.component';
import { ProfileComponent } from './components/profile/profile.component';
import { DatePickerComponent } from './components/date-picker/date-picker.component';
import { TimePickerComponent } from './components/time-picker/time-picker.component';
import { SelectComponent } from './components/select/select.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    CalendarComponent,
    WorkOrderFormComponent,
    WorkOrderDetailComponent,
    CancelledOrdersComponent,
    HospitalSettingsComponent,
    UserSettingsComponent,
    ProfileComponent,
    DatePickerComponent,
    TimePickerComponent,
    SelectComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    AppRoutingModule,
    ToastrModule.forRoot({
      positionClass: 'toast-top-right',
      timeOut: 4200,
      maxOpened: 3,
      autoDismiss: true,
      preventDuplicates: true,
      progressBar: true,
      progressAnimation: 'increasing',
      closeButton: true
    })
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
