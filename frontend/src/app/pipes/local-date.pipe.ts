import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { I18nService } from '../services/i18n.service';

// ห่อ date pipe ของ Angular แล้วบวกปีด้วย 543 ให้เป็น พ.ศ. ตอนภาษาเป็นไทย
// ให้วันที่ทั้งแอปแสดงปีตรงกับที่ปฏิทินโชว์อยู่แล้ว
@Pipe({ name: 'localDate', standalone: false, pure: false })
export class LocalDatePipe implements PipeTransform {
  constructor(private i18n: I18nService, private datePipe: DatePipe) {}

  // ใส่ timezone เป็น UTC เฉพาะ field วันที่ปฏิทินล้วนๆ เช่น plannedDate endDate
  // ส่วน timestamp จริง เช่น createdAt cancelledAt ปล่อยเป็น local time ตามปกติ
  transform(value: unknown, format: string = 'dd/MM/yyyy', timezone?: string): string {
    if (!value) return '';
    const formatted = this.datePipe.transform(value as any, format, timezone);
    if (!formatted || this.i18n.lang !== 'th') return formatted || '';

    const date = new Date(value as any);
    if (Number.isNaN(date.getTime())) return formatted;

    const yearStr = timezone
      ? new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric' }).format(date)
      : String(date.getFullYear());
    const buddhistYear = String(Number(yearStr) + 543);
    return formatted.replace(yearStr, buddhistYear);
  }
}
