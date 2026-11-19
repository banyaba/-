import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarRange,
  BookOpenCheck,
  BarChart3,
  PieChart,
  GraduationCap,
  Layers,
  Users,
  Activity,
  Printer,
} from 'lucide-react';
import { THAI_MONTHS, type AppSettings, type UsageLog } from '../types';
import { filterLogsForReport, formatThaiFullDate, getTodayISO } from '../utils/thaiDate';

interface StatisticsViewProps {
  logs: UsageLog[];
  settings: AppSettings;
}

type PeriodType = 'daily' | 'monthly' | 'semester' | 'yearly';

interface PieDatum {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

const CLASS_CHART_COLORS: readonly string[] = [
  '#2563eb', // blue-600
  '#0891b2', // cyan-600
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#e11d48', // rose-600
  '#84cc16', // lime-500
  '#0284c7', // sky-600
  '#a855f7', // purple-500
  '#d97706', // amber-600
  '#059669', // emerald-600
  '#db2777', // pink-600
  '#4f46e5', // indigo-600
  '#0d9488', // teal-600
];

const USAGE_CHART_COLORS: readonly string[] = [
  '#7c3aed', // violet-600
  '#059669', // emerald-600
  '#2563eb', // blue-600
  '#f59e0b', // amber-500
  '#e11d48', // rose-600
  '#0891b2', // cyan-600
  '#ea580c', // orange-600
  '#db2777', // pink-600
  '#14b8a6', // teal-500
  '#4f46e5', // indigo-600
  '#65a30d', // lime-600
  '#c026d3', // fuchsia-600
];

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describePieSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

interface InteractivePieCardProps {
  title: string;
  subtitle: string;
  icon: typeof PieChart;
  headerGradient: string;
  iconGradient: string;
  borderAccent: string;
  unitLabel: string;
  data: PieDatum[];
  totalValue: number;
  onPrint?: () => void;
  printHidden?: boolean;
  isPrintTarget?: boolean;
  printHeader?: {
    schoolName: string;
    periodLabel: string;
    academicYear: string;
    labManager: string;
    printedDate: string;
  };
}

function InteractivePieCard({
  title,
  subtitle,
  icon: Icon,
  headerGradient,
  iconGradient,
  borderAccent,
  unitLabel,
  data,
  totalValue,
  onPrint,
  printHidden = false,
  isPrintTarget = false,
  printHeader,
}: InteractivePieCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const slices = useMemo(() => {
    let currentAngle = 0;
    return data.map((item, idx) => {
      const sweepAngle = totalValue > 0 ? (item.value / totalValue) * 360 : 0;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweepAngle;
      const midAngle = startAngle + sweepAngle / 2;
      currentAngle = endAngle;
      return {
        ...item,
        idx,
        startAngle,
        endAngle,
        midAngle,
        sweepAngle,
      };
    });
  }, [data, totalValue]);

  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] ?? null : null;

  return (
    <section
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden flex flex-col ${
        printHidden ? 'no-print' : ''
      } ${isPrintTarget ? 'print-only-container' : ''}`}
    >
      {/* Official Print Header (A4 only) */}
      {isPrintTarget && printHeader && (
        <header className="hidden print:block border-b-2 border-slate-800 pb-4 mb-4 text-center">
          <h2 className="text-lg font-bold text-slate-900">{printHeader.schoolName}</h2>
          <p className="mt-1 text-base font-semibold text-sky-900">
            {title} — {subtitle}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-700">{printHeader.periodLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            ปีการศึกษา {printHeader.academicYear} · ผู้รับผิดชอบห้องคอมพิวเตอร์: {printHeader.labManager} · รวม{' '}
            {totalValue.toLocaleString('th-TH')} {unitLabel}
          </p>
        </header>
      )}

      {/* Header Banner */}
      <div
        className={`${
          isPrintTarget ? 'print:hidden' : ''
        } flex flex-wrap items-center justify-between gap-3 border-b ${borderAccent} bg-gradient-to-r ${headerGradient} px-6 py-4`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${iconGradient} text-white shadow-xs shrink-0`}
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
            รวม {totalValue.toLocaleString('th-TH')} {unitLabel}
          </span>
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="no-print inline-flex items-center gap-1.5 rounded-lg border border-sky-200 dark:border-sky-800/80 bg-white/95 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-700 shadow-2xs transition-colors whitespace-nowrap"
              title={`พิมพ์${title}`}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>พิมพ์</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {slices.length === 0 || totalValue === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
            <PieChart className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            ยังไม่มีข้อมูลในช่วงเวลาที่เลือก
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            ลองเลือกวัน เดือน ภาคเรียน หรือปีการศึกษาอื่นที่มีการบันทึกใช้งาน
          </p>
        </div>
      ) : (
        <div className="p-6 flex flex-col lg:flex-row items-center lg:items-start gap-6 flex-1">
          {/* SVG Pie Chart */}
          <div className="flex flex-col items-center shrink-0">
            <div className="relative w-60 h-60 sm:w-64 sm:h-64">
              <svg
                viewBox="0 0 260 260"
                className="w-full h-full drop-shadow-xs"
                role="img"
                aria-label={title}
              >
                {slices.length === 1 || slices[0].sweepAngle >= 359.99 ? (
                  <g
                    onMouseEnter={() => setHoveredIndex(0)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer transition-transform duration-150"
                  >
                    <circle
                      cx={130}
                      cy={130}
                      r={110}
                      fill={slices[0].color}
                      stroke="var(--theme-surface)"
                      strokeWidth={2.5}
                    />
                    <text
                      x={130}
                      y={135}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="15"
                      fontWeight="700"
                      className="pointer-events-none select-none font-mono-num"
                    >
                      100%
                    </text>
                  </g>
                ) : (
                  slices.map((slice) => {
                    const isHovered = hoveredIndex === slice.idx;
                    const isDimmed = hoveredIndex !== null && !isHovered;
                    const labelPos = polarToCartesian(130, 130, 72, slice.midAngle);
                    const offsetPos = isHovered
                      ? polarToCartesian(0, 0, 5, slice.midAngle)
                      : { x: 0, y: 0 };

                    return (
                      <g
                        key={slice.label}
                        transform={`translate(${offsetPos.x}, ${offsetPos.y})`}
                        onMouseEnter={() => setHoveredIndex(slice.idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="cursor-pointer transition-all duration-150"
                        style={{ opacity: isDimmed ? 0.55 : 1 }}
                      >
                        <path
                          d={describePieSlice(130, 130, 108, slice.startAngle, slice.endAngle)}
                          fill={slice.color}
                          stroke="var(--theme-surface)"
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                        />
                        {slice.percentage >= 6 && (
                          <text
                            x={labelPos.x}
                            y={labelPos.y + 4}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="11.5"
                            fontWeight="700"
                            className="pointer-events-none select-none font-mono-num"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
                          >
                            {slice.percentage.toFixed(0)}%
                          </text>
                        )}
                      </g>
                    );
                  })
                )}
              </svg>
            </div>

            {/* Active / Hovered Slice Detail Strip */}
            <div className="no-print mt-2 min-h-[2.25rem] flex items-center justify-center">
              {activeSlice ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: activeSlice.color }}
                  />
                  <span className="font-semibold">{activeSlice.label}</span>
                  <span className="font-mono-num text-slate-600 dark:text-slate-300">
                    {activeSlice.value.toLocaleString('th-TH')} {unitLabel} (
                    {activeSlice.percentage.toFixed(1)}%)
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  ชี้ที่ชิ้นกราฟหรือรายการด้านข้างเพื่อดูรายละเอียด
                </span>
              )}
            </div>
          </div>

          {/* Interactive Legend & Percentage Breakdown */}
          <div className="w-full flex-1 space-y-2 max-h-[21rem] overflow-y-auto pr-1 print:max-h-none print:overflow-visible print:pr-0">
            {slices.map((slice) => {
              const isHovered = hoveredIndex === slice.idx;
              return (
                <div
                  key={slice.label}
                  onMouseEnter={() => setHoveredIndex(slice.idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`rounded-lg border px-3 py-2 transition-colors cursor-default print:bg-white print:border-slate-200 ${
                    isHovered
                      ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80'
                      : 'border-slate-100 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-sm shrink-0"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-100 print:text-slate-900 truncate">
                        {slice.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono-num">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">
                        {slice.value.toLocaleString('th-TH')} {unitLabel}
                      </span>
                      <span className="w-12 text-right text-slate-500 dark:text-slate-400 print:text-slate-600">
                        {slice.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 print:bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(slice.percentage, 2)}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Official Print Footer (A4 only) */}
      {isPrintTarget && printHeader && (
        <footer className="hidden print:flex mt-8 pt-3 border-t border-slate-200 items-center justify-between text-[11px] text-slate-500">
          <span>วันที่พิมพ์: {printHeader.printedDate}</span>
          <span>{printHeader.schoolName}</span>
        </footer>
      )}
    </section>
  );
}

export function StatisticsView({ logs, settings }: StatisticsViewProps) {
  const now = new Date();
  const defaultBeYear = Number(settings.academicYear) || now.getFullYear() + 543;

  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [date, setDate] = useState<string>(getTodayISO());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [beYear, setBeYear] = useState<number>(defaultBeYear);
  const [semester, setSemester] = useState<'1' | '2'>('1');
  const [academicYear, setAcademicYear] = useState<number>(defaultBeYear);
  const [yearlyMode, setYearlyMode] = useState<'academic' | 'calendar'>('academic');
  const [printingChart, setPrintingChart] = useState<'classes' | null>(null);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingChart(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handlePrintClassesChart = () => {
    setPrintingChart('classes');
    setTimeout(() => {
      window.print();
    }, 80);
  };

  const todayThai = formatThaiFullDate(getTodayISO());

  const availableBeYears = useMemo(() => {
    const set = new Set<number>([defaultBeYear, now.getFullYear() + 543, 2568, 2567]);
    logs.forEach((l) => {
      if (l.date && /^\d{4}/.test(l.date)) {
        set.add(Number(l.date.slice(0, 4)) + 543);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [logs, defaultBeYear]);

  const filteredLogs = useMemo(
    () =>
      filterLogsForReport(logs, {
        type: periodType,
        date,
        month,
        beYear,
        semester,
        academicYear,
        yearlyMode,
      }),
    [logs, periodType, date, month, beYear, semester, academicYear, yearlyMode]
  );

  const periodLabel = useMemo(() => {
    if (periodType === 'daily') {
      return `สถิติประจำวันที่ ${formatThaiFullDate(date)}`;
    }
    if (periodType === 'monthly') {
      const m = THAI_MONTHS[month - 1];
      return `สถิติประจำเดือน ${m ? m.full : month} พ.ศ. ${beYear}`;
    }
    if (periodType === 'semester') {
      const semLabel =
        semester === '1' ? 'ภาคเรียนที่ 1 (พ.ค. – ก.ย.)' : 'ภาคเรียนที่ 2 (ต.ค. – เม.ย.)';
      return `สถิติ${semLabel} ปีการศึกษา ${academicYear}`;
    }
    return yearlyMode === 'academic'
      ? `สถิติประจำปีการศึกษา ${academicYear} (พ.ค. ${academicYear} – เม.ย. ${academicYear + 1})`
      : `สถิติประจำปี พ.ศ. ${academicYear} (ม.ค. – ธ.ค.)`;
  }, [periodType, date, month, beYear, semester, academicYear, yearlyMode]);

  const { classPieData, usagePieData, totalUsageSelections, uniqueStudentsCount } = useMemo(() => {
    const classCounts = new Map<string, number>();
    const usageCounts = new Map<string, number>();
    const studentKeys = new Set<string>();

    for (const log of filteredLogs) {
      const cls = log.className?.trim() || 'ไม่ระบุชั้น';
      classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
      studentKeys.add(`${cls}::${log.studentName}`);

      if (log.usageTypes && log.usageTypes.length > 0) {
        for (const u of log.usageTypes) {
          const clean = u.trim();
          if (clean) {
            usageCounts.set(clean, (usageCounts.get(clean) || 0) + 1);
          }
        }
      } else {
        usageCounts.set('ไม่ระบุรูปแบบ', (usageCounts.get('ไม่ระบุรูปแบบ') || 0) + 1);
      }
    }

    const totalLogs = filteredLogs.length;
    const classData: PieDatum[] = Array.from(classCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))
      .map(([label, value], index) => ({
        label,
        value,
        percentage: totalLogs > 0 ? (value / totalLogs) * 100 : 0,
        color: CLASS_CHART_COLORS[index % CLASS_CHART_COLORS.length],
      }));

    const totalSelections = Array.from(usageCounts.values()).reduce((sum, v) => sum + v, 0);
    const usageData: PieDatum[] = Array.from(usageCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))
      .map(([label, value], index) => ({
        label,
        value,
        percentage: totalSelections > 0 ? (value / totalSelections) * 100 : 0,
        color: USAGE_CHART_COLORS[index % USAGE_CHART_COLORS.length],
      }));

    return {
      classPieData: classData,
      usagePieData: usageData,
      totalUsageSelections: totalSelections,
      uniqueStudentsCount: studentKeys.size,
    };
  }, [filteredLogs]);

  const periodButtons: {
    id: PeriodType;
    label: string;
    icon: typeof Calendar;
    activeGrad: string;
    iconBg: string;
  }[] = [
    {
      id: 'daily',
      label: 'รายวัน',
      icon: Calendar,
      activeGrad: 'from-sky-600 to-cyan-600',
      iconBg: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
    },
    {
      id: 'monthly',
      label: 'รายเดือน',
      icon: CalendarRange,
      activeGrad: 'from-cyan-600 to-blue-600',
      iconBg: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400',
    },
    {
      id: 'semester',
      label: 'รายภาค',
      icon: BookOpenCheck,
      activeGrad: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    },
    {
      id: 'yearly',
      label: 'รายปี',
      icon: BarChart3,
      activeGrad: 'from-violet-600 to-indigo-600',
      iconBg: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Period Selector Card */}
      <div
        className={`${
          printingChart ? 'no-print' : ''
        } rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100/80 dark:border-cyan-900/50 bg-gradient-to-r from-cyan-50/90 via-sky-50/70 to-transparent dark:from-cyan-950/40 dark:via-sky-950/30 dark:to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xs shrink-0">
              <PieChart className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                เลือกช่วงเวลาแสดงสถิติการใช้ห้องคอมพิวเตอร์
              </h2>
              <p className="text-xs text-cyan-700 dark:text-cyan-300 font-medium">{periodLabel}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* 4 Period Type Buttons */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {periodButtons.map((item) => {
              const Icon = item.icon;
              const active = periodType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriodType(item.id)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap ${
                    active
                      ? `border-transparent bg-gradient-to-r ${item.activeGrad} text-white shadow-sm`
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md shrink-0 ${
                      active ? 'bg-white/20 text-white' : item.iconBg
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Period Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {periodType === 'daily' && (
              <div>
                <label
                  htmlFor="stat-date"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  เลือกวันที่
                </label>
                <input
                  id="stat-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}

            {periodType === 'monthly' && (
              <>
                <div>
                  <label
                    htmlFor="stat-month"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    เลือกเดือน
                  </label>
                  <select
                    id="stat-month"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {THAI_MONTHS.map((m) => (
                      <option key={m.index} value={m.index + 1}>
                        {m.full}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="stat-be-year"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ปี พ.ศ.
                  </label>
                  <select
                    id="stat-be-year"
                    value={beYear}
                    onChange={(e) => setBeYear(Number(e.target.value))}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {availableBeYears.map((y) => (
                      <option key={y} value={y}>
                        พ.ศ. {y}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {periodType === 'semester' && (
              <>
                <div>
                  <label
                    htmlFor="stat-semester"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ภาคเรียน
                  </label>
                  <select
                    id="stat-semester"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value as '1' | '2')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="1">ภาคเรียนที่ 1 (พ.ค. – ก.ย.)</option>
                    <option value="2">ภาคเรียนที่ 2 (ต.ค. – เม.ย.)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="stat-sem-year"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ปีการศึกษา
                  </label>
                  <select
                    id="stat-sem-year"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(Number(e.target.value))}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {availableBeYears.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {periodType === 'yearly' && (
              <>
                <div>
                  <label
                    htmlFor="stat-yearly-year"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ปีการศึกษา
                  </label>
                  <select
                    id="stat-yearly-year"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(Number(e.target.value))}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {availableBeYears.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="stat-yearly-mode"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ขอบเขตเดือน
                  </label>
                  <select
                    id="stat-yearly-mode"
                    value={yearlyMode}
                    onChange={(e) => setYearlyMode(e.target.value as 'academic' | 'calendar')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="academic">ตามปีการศึกษา (พ.ค. – เม.ย.)</option>
                    <option value="calendar">ตามปีปฏิทิน (ม.ค. – ธ.ค.)</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Tiles */}
      <div
        className={`${
          printingChart ? 'no-print' : ''
        } grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`}
      >
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/60 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              ครั้งการเข้าใช้
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {filteredLogs.length.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            รายการในช่วงเวลาที่เลือก
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              นักเรียนที่เข้าใช้
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {uniqueStudentsCount.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">คน (ไม่ซ้ำชื่อ)</div>
        </div>

        <div className="rounded-xl border border-cyan-200/80 dark:border-cyan-900/60 bg-gradient-to-br from-cyan-50/90 via-white to-sky-50/60 dark:from-cyan-950/40 dark:via-slate-900 dark:to-sky-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              จำนวนชั้นที่เข้าใช้
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-sky-600 text-white shadow-xs">
              <GraduationCap className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {classPieData.length.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            ชั้นเรียนที่มีการใช้งาน
          </div>
        </div>

        <div className="rounded-xl border border-violet-200/80 dark:border-violet-900/60 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-fuchsia-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              รูปแบบการใช้ที่พบ
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-xs">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {usagePieData.length.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            ประเภท (รวม {totalUsageSelections.toLocaleString('th-TH')} รายการที่เลือก)
          </div>
        </div>
      </div>

      {/* 2 Pie Charts Grid */}
      <div
        className={
          printingChart
            ? 'print:block grid grid-cols-1 xl:grid-cols-2 gap-6'
            : 'grid grid-cols-1 xl:grid-cols-2 gap-6'
        }
      >
        <InteractivePieCard
          title="กราฟวงกลมแสดงชั้นที่เข้าใช้"
          subtitle="สัดส่วนจำนวนครั้งการเข้าใช้จำแนกตามระดับชั้นเรียน"
          icon={GraduationCap}
          headerGradient="from-sky-50/90 via-cyan-50/70 to-transparent dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-transparent"
          iconGradient="from-sky-600 to-cyan-600"
          borderAccent="border-sky-100/80 dark:border-sky-900/50"
          unitLabel="ครั้ง"
          data={classPieData}
          totalValue={filteredLogs.length}
          onPrint={handlePrintClassesChart}
          isPrintTarget={printingChart === 'classes'}
          printHeader={{
            schoolName: settings.schoolName,
            periodLabel,
            academicYear: settings.academicYear,
            labManager: settings.labManager,
            printedDate: todayThai,
          }}
        />

        <InteractivePieCard
          title="กราฟวงกลมแสดงรูปแบบการใช้"
          subtitle="สัดส่วนกิจกรรมและรูปแบบการใช้ห้องคอมพิวเตอร์ทั้งหมด"
          icon={Layers}
          headerGradient="from-violet-50/90 via-fuchsia-50/70 to-transparent dark:from-violet-950/40 dark:via-fuchsia-950/30 dark:to-transparent"
          iconGradient="from-violet-600 to-fuchsia-600"
          borderAccent="border-violet-100/80 dark:border-violet-900/50"
          unitLabel="ครั้ง"
          data={usagePieData}
          totalValue={totalUsageSelections}
          printHidden={printingChart === 'classes'}
        />
      </div>
    </div>
  );
}
