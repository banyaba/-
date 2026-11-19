import { THAI_MONTHS, UsageLog } from '../types';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * Formats ISO date (2026-11-17) as Buddhist Era YYYY-MM-DD (2569-11-17)
 */
export function formatBuddhistISO(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-');
  const beYear = Number(y) + 543;
  return `${beYear}-${m}-${d}`;
}

/**
 * Formats ISO date as readable Thai date: e.g. 17 พ.ย. 2569
 */
export function formatThaiShortDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  const monthCfg = THAI_MONTHS[m - 1];
  const beYear = y + 543;
  return `${d} ${monthCfg ? monthCfg.short : m} ${beYear}`;
}

/**
 * Formats ISO date as full Thai date: e.g. 17 พฤศจิกายน 2569
 */
export function formatThaiFullDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  const monthCfg = THAI_MONTHS[m - 1];
  const beYear = y + 543;
  return `${d} ${monthCfg ? monthCfg.full : m} ${beYear}`;
}

/**
 * Matches a log date against a Thai Academic Year & Semester.
 * Academic Year 2569 (Gregorian base 2026):
 * - Semester 1: May (05) to Sep (09) of base year (2026)
 * - Semester 2: Oct (10) to Dec (12) of base year (2026) AND Jan (01) to Apr (04) of base+1 (2027)
 * - Full Year: May (05) of base year to Apr (04) of base+1 (or calendar year match if preferred;
 *   here we include Thai academic year May Y -> Apr Y+1, or Jan-Dec if user picks calendar).
 *   Wait: Thai school reports often group either Thai Academic Year (พ.ค. Y - เม.ย. Y+1)
 *   AND calendar logs in Jan-Apr of Y if entered during calendar year. Let's inspect clearly:
 *   Semester 1: พ.ค. - ก.ย. (months 5-9 of Gregorian = academicYear - 543)
 *   Semester 2: ต.ค. - ธ.ค. of (academicYear - 543) OR ม.ค. - เม.ย. of (academicYear - 543 + 1)
 *   Yearly report: matches either Thai Academic Year (May Y to Apr Y+1) OR calendar year Y?
 *   Wait: let's check what users expect for "รายปี -> ปีการศึกษา 2569":
 *   In Thailand, Academic Year 2569 runs from May 2569 (2026-05) to April 2570 (2027-04),
 *   and if someone logs data in Jan-Apr 2569, that's Semester 2 of Academic Year 2568!
 *   However, in a demo/school app, teachers sometimes enter dates in 2569 (2026-01 to 2026-12)
 *   and select ปีการศึกษา 2569 expecting all 2569 records. Let's handle Yearly report by
 *   matching Academic Year (May 2026 - Apr 2027) OR providing a clear subtitle showing the range,
 *   wait: let's support Academic Year range (พ.ค. Y - เม.ย. Y+1) cleanly AND if the user wants
 *   all months in BE year Y (ม.ค.-ธ.ค. Y), wait: let's check the prompt:
 *   "3. รายภาค -> ภาค 1 (พ.ค.-ก.ย.) / ภาค 2 (ต.ค.-เม.ย.) + ปีการศึกษา"
 *   "4. รายปี -> ปีการศึกษา"
 *   Following that exact definition:
 *   - ภาค 1 of ปีการศึกษา Y = พ.ค.–ก.ย. (month 5..9 of Gregorian Y-543)
 *   - ภาค 2 of ปีการศึกษา Y = ต.ค.–ธ.ค. of Gregorian (Y-543) AND ม.ค.–เม.ย. of Gregorian (Y-543+1)
 *   - รายปี of ปีการศึกษา Y = ภาค 1 + ภาค 2 (พ.ค. Y – เม.ย. Y+1) OR we can include a toggle "ตลอดปีการศึกษา (พ.ค.–เม.ย.) / ตลอดปีปฏิทิน (ม.ค.–ธ.ค.)" in Yearly! That way a teacher never gets confused if they logged data in Jan–Apr 2569!
 */
export function filterLogsForReport(
  logs: UsageLog[],
  params: {
    type: 'daily' | 'monthly' | 'semester' | 'yearly';
    date: string;
    month: number; // 1-12
    beYear: number;
    semester: '1' | '2';
    academicYear: number;
    yearlyMode?: 'academic' | 'calendar';
  }
): UsageLog[] {
  return logs.filter((log) => {
    if (!log.date || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) return false;
    const [gYear, gMonth] = log.date.split('-').map(Number);

    if (params.type === 'daily') {
      return log.date === params.date;
    }

    if (params.type === 'monthly') {
      const targetGYear = params.beYear - 543;
      return gYear === targetGYear && gMonth === params.month;
    }

    if (params.type === 'semester') {
      const baseGYear = params.academicYear - 543;
      if (params.semester === '1') {
        return gYear === baseGYear && gMonth >= 5 && gMonth <= 9;
      } else {
        return (
          (gYear === baseGYear && gMonth >= 10 && gMonth <= 12) ||
          (gYear === baseGYear + 1 && gMonth >= 1 && gMonth <= 4)
        );
      }
    }

    if (params.type === 'yearly') {
      const baseGYear = params.academicYear - 543;
      if (params.yearlyMode === 'calendar') {
        return gYear === baseGYear;
      }
      return (
        (gYear === baseGYear && gMonth >= 5 && gMonth <= 12) ||
        (gYear === baseGYear + 1 && gMonth >= 1 && gMonth <= 4)
      );
    }

    return false;
  });
}

export function exportLogsToCSV(logs: UsageLog[], filename: string): void {
  const headers = [
    'ลำดับ',
    'วันที่ (พ.ศ.)',
    'เข้าใช้',
    'ห้องคอม',
    'เครื่องที่ใช้',
    'ชื่อ-สกุล',
    'ชั้นเรียน',
    'รายวิชา',
    'รูปแบบการใช้',
    'หมายเหตุ',
    'ครูผู้สอน',
  ];

  const escapeCell = (value: string) => {
    const str = String(value ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = logs.map((log, idx) => [
    String(idx + 1),
    formatBuddhistISO(log.date),
    log.timeIn || '-',
    log.computerRoom || '-',
    log.computerNumber || '-',
    log.studentName,
    log.className,
    log.subjectName,
    log.usageTypes.join(', '),
    log.note || '',
    log.recorder,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
