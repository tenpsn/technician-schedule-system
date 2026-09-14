import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScheduleSearchService {
  private querySubject = new BehaviorSubject<string>('');
  public query$ = this.querySubject.asObservable();

  get query(): string {
    return this.querySubject.value;
  }

  set query(value: string) {
    this.querySubject.next(value);
  }
}
