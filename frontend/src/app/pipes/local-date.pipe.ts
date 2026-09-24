import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { I18nService } from '../services/i18n.service';

// ตรงกับ regex วันที่ล้วนๆ ที่ Angular DatePipe เองใช้แยกแยะรูปแบบ "YYYY-MM-DD" (ไม่มีเวลา)
const DATE_ONLY_REGEX = /^\d{4}-\d{1,2}-\d{1,2}$/;

// ห่อ date pipe ของ Angular แล้วบวกปีด้วย 543 ให้เป็น พ.ศ. ตอนภาษาเป็นไทย
// ให้วันที่ทั้งแอปแสดงปีตรงกับที่ปฏิทินโชว์อยู่แล้ว
@Pipe({ name: 'localDate', standalone: false, pure: false })
export class LocalDatePipe implements PipeTransform {
  constructor(private i18n: I18nService, private datePipe: DatePipe) {}

  // ใส่ timezone เป็น UTC เฉพาะ field วันที่ปฏิทินล้วนๆ เช่น plannedDate endDate
  // ส่วน timestamp จริง เช่น createdAt cancelledAt ปล่อยเป็น local time ตามปกติ
  //
  // ค่าวันที่ล้วนๆ อย่าง "2026-09-20" ตัว Angular DatePipe เองจะ parse เป็นเที่ยงคืนตามเวลาเครื่องอยู่แล้ว (ถูกต้องตามวันที่ปฏิทินพอดี)
  // ถ้ายังส่ง timezone 'UTC' ต่อให้มันแปลงซ้ำอีกที จะโดนลบชดเชยเขตเวลาไทย (+7) ออกไปอีกรอบ ทำให้วันเลื่อนถอยหลัง 1 วันเสมอ
  // จึงต้องไม่ส่ง timezone ต่อให้ Angular ในกรณีนี้ ปล่อยให้มัน parse แบบ local ตามที่มันทำถูกอยู่แล้ว
  transform(value: unknown, format: string = 'dd/MM/yyyy', timezone?: string): string {
    if (!value) return '';
    const isDateOnly = typeof value === 'string' && DATE_ONLY_REGEX.test(value.trim());
    const formatted = this.datePipe.transform(value as any, format, isDateOnly ? undefined : timezone);
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
