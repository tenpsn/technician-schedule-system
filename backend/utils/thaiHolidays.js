// Thai government public holidays that fall on the same date every year.
// Lunar-calendar holidays (Makha Bucha, Visakha Bucha, Asalha Bucha, Buddhist Lent)
// are intentionally left out for now — their Gregorian date changes every year and
// needs to be confirmed against the official calendar rather than hardcoded here.
const FIXED_HOLIDAYS_MMDD = [
  '01-01', // วันขึ้นปีใหม่
  '04-06', // วันจักรี
  '04-13', '04-14', '04-15', // วันสงกรานต์
  '05-01', // วันแรงงานแห่งชาติ
  '05-04', // วันฉัตรมงคล
  '07-28', // วันเฉลิมพระชนมพรรษา ร.10
  '08-12', // วันแม่แห่งชาติ
  '10-13', // วันคล้ายวันสวรรคต ร.9
  '10-23', // วันปิยมหาราช
  '12-05', // วันพ่อแห่งชาติ
  '12-10', // วันรัฐธรรมนูญ
  '12-31'  // วันสิ้นปี
];

function isWeekend(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

function isFixedHoliday(dateStr) {
  return FIXED_HOLIDAYS_MMDD.includes(dateStr.slice(5));
}

function isNonBusinessDay(dateStr) {
  return isWeekend(dateStr) || isFixedHoliday(dateStr);
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Rolls a date forward to the next day that isn't a weekend or fixed holiday.
function nextBusinessDay(dateStr) {
  let current = dateStr;
  while (isNonBusinessDay(current)) {
    current = addDays(current, 1);
  }
  return current;
}

module.exports = { isWeekend, isFixedHoliday, isNonBusinessDay, nextBusinessDay };
