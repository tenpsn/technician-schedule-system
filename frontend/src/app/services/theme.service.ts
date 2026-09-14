import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'ui.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private modeSubject = new BehaviorSubject<ThemeMode>(this.loadInitial());
  public mode$ = this.modeSubject.asObservable();

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

  get glyph(): string {
    return this.mode === 'dark' ? '☀' : '☾';
  }

  toggle(): void {
    this.set(this.mode === 'light' ? 'dark' : 'light');
  }

  set(mode: ThemeMode): void {
    this.modeSubject.next(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    this.apply(mode);
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
