import { SelectOption } from '../components/select/select.component';

// รายชื่อ 77 จังหวัด ค่าที่บันทึกลง DB คือชื่อไทยเสมอ ชื่ออังกฤษใช้แค่แสดงผล
const PROVINCES: { th: string; en: string }[] = [
  { th: 'กรุงเทพมหานคร', en: 'Bangkok' },
  { th: 'กระบี่', en: 'Krabi' },
  { th: 'กาญจนบุรี', en: 'Kanchanaburi' },
  { th: 'กาฬสินธุ์', en: 'Kalasin' },
  { th: 'กำแพงเพชร', en: 'Kamphaeng Phet' },
  { th: 'ขอนแก่น', en: 'Khon Kaen' },
  { th: 'จันทบุรี', en: 'Chanthaburi' },
  { th: 'ฉะเชิงเทรา', en: 'Chachoengsao' },
  { th: 'ชลบุรี', en: 'Chon Buri' },
  { th: 'ชัยนาท', en: 'Chai Nat' },
  { th: 'ชัยภูมิ', en: 'Chaiyaphum' },
  { th: 'ชุมพร', en: 'Chumphon' },
  { th: 'เชียงราย', en: 'Chiang Rai' },
  { th: 'เชียงใหม่', en: 'Chiang Mai' },
  { th: 'ตรัง', en: 'Trang' },
  { th: 'ตราด', en: 'Trat' },
  { th: 'ตาก', en: 'Tak' },
  { th: 'นครนายก', en: 'Nakhon Nayok' },
  { th: 'นครปฐม', en: 'Nakhon Pathom' },
  { th: 'นครพนม', en: 'Nakhon Phanom' },
  { th: 'นครราชสีมา', en: 'Nakhon Ratchasima' },
  { th: 'นครศรีธรรมราช', en: 'Nakhon Si Thammarat' },
  { th: 'นครสวรรค์', en: 'Nakhon Sawan' },
  { th: 'นนทบุรี', en: 'Nonthaburi' },
  { th: 'นราธิวาส', en: 'Narathiwat' },
  { th: 'น่าน', en: 'Nan' },
  { th: 'บึงกาฬ', en: 'Bueng Kan' },
  { th: 'บุรีรัมย์', en: 'Buri Ram' },
  { th: 'ปทุมธานี', en: 'Pathum Thani' },
  { th: 'ประจวบคีรีขันธ์', en: 'Prachuap Khiri Khan' },
  { th: 'ปราจีนบุรี', en: 'Prachin Buri' },
  { th: 'ปัตตานี', en: 'Pattani' },
  { th: 'พระนครศรีอยุธยา', en: 'Phra Nakhon Si Ayutthaya' },
  { th: 'พะเยา', en: 'Phayao' },
  { th: 'พังงา', en: 'Phang Nga' },
  { th: 'พัทลุง', en: 'Phatthalung' },
  { th: 'พิจิตร', en: 'Phichit' },
  { th: 'พิษณุโลก', en: 'Phitsanulok' },
  { th: 'เพชรบุรี', en: 'Phetchaburi' },
  { th: 'เพชรบูรณ์', en: 'Phetchabun' },
  { th: 'แพร่', en: 'Phrae' },
  { th: 'ภูเก็ต', en: 'Phuket' },
  { th: 'มหาสารคาม', en: 'Maha Sarakham' },
  { th: 'มุกดาหาร', en: 'Mukdahan' },
  { th: 'แม่ฮ่องสอน', en: 'Mae Hong Son' },
  { th: 'ยโสธร', en: 'Yasothon' },
  { th: 'ยะลา', en: 'Yala' },
  { th: 'ร้อยเอ็ด', en: 'Roi Et' },
  { th: 'ระนอง', en: 'Ranong' },
  { th: 'ระยอง', en: 'Rayong' },
  { th: 'ราชบุรี', en: 'Ratchaburi' },
  { th: 'ลพบุรี', en: 'Lop Buri' },
  { th: 'ลำปาง', en: 'Lampang' },
  { th: 'ลำพูน', en: 'Lamphun' },
  { th: 'เลย', en: 'Loei' },
  { th: 'ศรีสะเกษ', en: 'Si Sa Ket' },
  { th: 'สกลนคร', en: 'Sakon Nakhon' },
  { th: 'สงขลา', en: 'Songkhla' },
  { th: 'สตูล', en: 'Satun' },
  { th: 'สมุทรปราการ', en: 'Samut Prakan' },
  { th: 'สมุทรสงคราม', en: 'Samut Songkhram' },
  { th: 'สมุทรสาคร', en: 'Samut Sakhon' },
  { th: 'สระแก้ว', en: 'Sa Kaeo' },
  { th: 'สระบุรี', en: 'Saraburi' },
  { th: 'สิงห์บุรี', en: 'Sing Buri' },
  { th: 'สุโขทัย', en: 'Sukhothai' },
  { th: 'สุพรรณบุรี', en: 'Suphan Buri' },
  { th: 'สุราษฎร์ธานี', en: 'Surat Thani' },
  { th: 'สุรินทร์', en: 'Surin' },
  { th: 'หนองคาย', en: 'Nong Khai' },
  { th: 'หนองบัวลำภู', en: 'Nong Bua Lam Phu' },
  { th: 'อ่างทอง', en: 'Ang Thong' },
  { th: 'อำนาจเจริญ', en: 'Amnat Charoen' },
  { th: 'อุดรธานี', en: 'Udon Thani' },
  { th: 'อุตรดิตถ์', en: 'Uttaradit' },
  { th: 'อุทัยธานี', en: 'Uthai Thani' },
  { th: 'อุบลราชธานี', en: 'Ubon Ratchathani' }
];

const EN_BY_TH: Record<string, string> = Object.fromEntries(PROVINCES.map(p => [p.th, p.en]));

export function getProvinceOptions(lang: 'th' | 'en'): SelectOption[] {
  return PROVINCES.map(p => ({ value: p.th, label: lang === 'en' ? p.en : p.th }));
}

export function getProvinceLabel(value: string | undefined | null, lang: 'th' | 'en'): string {
  if (!value) return '';
  return lang === 'en' ? (EN_BY_TH[value] || value) : value;
}

// ผังจังหวัดไปเขตอยู่ที่ backend ที่เดียว ดึงผ่าน ProvinceService แทนการก็อปมาไว้ที่นี่
const REGION_EN_BY_TH: Record<string, string> = {
  เหนือบน: 'Upper North', เหนือล่าง: 'Lower North', กลาง: 'Central', ตะวันตก: 'West',
  ตะวันออก: 'East', อีสานใต้: 'Lower Isaan', อีสานเหนือ: 'Upper Isaan', อีสาน: 'Isaan',
  ใต้: 'South', ส่วนกลาง: 'Greater Bangkok'
};

export function getRegionLabel(region: string | undefined | null, lang: 'th' | 'en'): string {
  if (!region) return '';
  return lang === 'en' ? (REGION_EN_BY_TH[region] || region) : region;
}
