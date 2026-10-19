import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'ui.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private modeSubject = new BehaviorSubject<ThemeMode>(this.loadInitial());
  public mode$ = this.modeSubject.asObservable();
  private switchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.apply(this.modeSubject.value);
  }

  private loadInitial(): ThemeMode {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  }

  get mode(): ThemeMode {
    return this.modeSubject.value;
  }

  toggle(): void {
    this.set(this.mode === 'light' ? 'dark' : 'light');
  }

  set(mode: ThemeMode): void {
    this.modeSubject.next(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    // ใส่ class ชั่วคราวให้สีทั้งหน้าค่อย ๆ เปลี่ยน แล้วเอาออกจะได้ไม่ทำให้หน้าอื่นช้า
    const root = document.documentElement;
    root.classList.add('theme-switching');
    clearTimeout(this.switchTimer);
    this.switchTimer = setTimeout(() => root.classList.remove('theme-switching'), 360);
    this.apply(mode);
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
