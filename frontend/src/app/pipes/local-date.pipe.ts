import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { I18nService } from '../services/i18n.service';

// Wraps Angular's date pipe and shifts the year to Buddhist Era (+543) when
// the UI language is Thai, so every date in the app matches how the calendar
// header already displays years (e.g. native toLocaleDateString('th-TH', ...)).
@Pipe({ name: 'localDate', standalone: false, pure: false })
export class LocalDatePipe implements PipeTransform {
  constructor(private i18n: I18nService, private datePipe: DatePipe) {}

  transform(value: unknown, format: string = 'dd/MM/yyyy'): string {
    if (!value) return '';
    const formatted = this.datePipe.transform(value as any, format);
    if (!formatted || this.i18n.lang !== 'th') return formatted || '';

    const date = new Date(value as any);
    if (Number.isNaN(date.getTime())) return formatted;

    const gregorianYear = String(date.getFullYear());
    const buddhistYear = String(date.getFullYear() + 543);
    return formatted.replace(gregorianYear, buddhistYear);
  }
}
