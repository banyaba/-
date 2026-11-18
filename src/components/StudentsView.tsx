import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  FileSpreadsheet,
  School,
  Eye,
  Upload,
  Pencil,
  Trash2,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Square,
  Search,
} from 'lucide-react';
import { CLASS_LIST, type Student } from '../types';
import { api } from '../api/client';
import { ConfirmModal } from './ConfirmModal';

interface StudentsViewProps {
  students: Student[];
  onStudentsChanged: (next: Student[]) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

interface ParsedStudentRow {
  rowIndex: number;
  numberRaw: string;
  number?: number;
  name: string;
  className: string;
  errors: string[];
  isValid: boolean;
}

export function StudentsView({
  students,
  onStudentsChanged,
  onNotify,
}: StudentsViewProps) {
  const [activeTab, setActiveTab] = useState<'add' | 'bulk' | 'manage'>('add');

  // Tab 1: Add / Edit Student
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [numberInput, setNumberInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [classInput, setClassInput] = useState(CLASS_LIST[12]); // ป.5/1
  const [savingOne, setSavingOne] = useState(false);

  // Tab 2: Bulk Import
  const [bulkText, setBulkText] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedStudentRow[] | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Tab 3: Class Management
  const [manageClass, setManageClass] = useState(CLASS_LIST[12]);
  const [manageSelectedIds, setManageSelectedIds] = useState<string[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: (() => Promise<void>) | null;
  }>({ open: false, title: '', description: '', action: null });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Table Filters
  const [tableClassFilter, setTableClassFilter] = useState('all');
  const [tableSearch, setTableSearch] = useState('');

  const filteredStudents = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return students
      .filter((s) => {
        if (tableClassFilter !== 'all' && s.className !== tableClassFilter) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.className.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const clsDiff = a.className.localeCompare(b.className, 'th');
        if (clsDiff !== 0) return clsDiff;
        return (a.number ?? 999) - (b.number ?? 999);
      });
  }, [students, tableClassFilter, tableSearch]);

  const manageClassStudents = useMemo(
    () =>
      students
        .filter((s) => s.className === manageClass)
        .sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
    [students, manageClass]
  );

  const handleSaveOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !classInput) {
      onNotify('error', 'กรุณากรอกชื่อ-สกุล และชั้นเรียน');
      return;
    }
    if (numberInput.trim() !== '' && (!/^\d+$/.test(numberInput.trim()) || Number(numberInput) <= 0)) {
      onNotify('error', 'เลขที่ต้องเป็นตัวเลขจำนวนเต็มบวก');
      return;
    }

    setSavingOne(true);
    try {
      const payload = {
        number: numberInput.trim() ? Number(numberInput.trim()) : undefined,
        name: nameInput.trim(),
        className: classInput,
      };
      if (editingStudent) {
        const updated = await api.updateStudent(editingStudent.id, payload);
        onStudentsChanged(students.map((s) => (s.id === updated.id ? updated : s)));
        onNotify('success', `อัปเดตข้อมูล ${updated.name} เรียบร้อยแล้ว`);
        setEditingStudent(null);
      } else {
        const created = await api.createStudent(payload);
        onStudentsChanged([...students, created]);
        onNotify('success', `เพิ่มนักเรียน ${created.name} เรียบร้อยแล้ว`);
      }
      setNumberInput('');
      setNameInput('');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลนักเรียนได้');
    } finally {
      setSavingOne(false);
    }
  };

  const handleStartEdit = (student: Student) => {
    setEditingStudent(student);
    setNumberInput(student.number !== undefined ? String(student.number) : '');
    setNameInput(student.name);
    setClassInput(student.className);
    setActiveTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviewBulk = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      onNotify('error', 'กรุณาวางข้อมูลจาก Excel ก่อนกดดูตัวอย่าง');
      return;
    }

    const parsed: ParsedStudentRow[] = [];
    lines.forEach((line, idx) => {
      // Split by tab first (Excel default), fallback to comma
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.split(',').map((p) => p.trim());

      // Skip header line if user accidentally copied Excel header
      if (
        idx === 0 &&
        (parts[0] === 'เลขที่' || parts[1] === 'ชื่อ-สกุล' || parts[2] === 'ชั้นเรียน')
      ) {
        return;
      }

      const numberRaw = parts[0] ?? '';
      const name = parts[1] ?? '';
      const className = parts[2] ?? '';

      const errors: string[] = [];
      let parsedNumber: number | undefined = undefined;

      if (numberRaw !== '') {
        if (!/^\d+$/.test(numberRaw) || Number(numberRaw) <= 0) {
          errors.push('เลขที่ต้องเป็นตัวเลข');
        } else {
          parsedNumber = Number(numberRaw);
        }
      }

      if (!name) {
        errors.push('ชื่อห้ามว่าง');
      }

      if (!CLASS_LIST.includes(className)) {
        errors.push('ชั้นเรียนไม่ถูกต้อง (ต้องเป็น ป.1/1 - ป.6/3)');
      }

      parsed.push({
        rowIndex: idx + 1,
        numberRaw,
        number: parsedNumber,
        name,
        className,
        errors,
        isValid: errors.length === 0,
      });
    });

    setPreviewRows(parsed);
  };

  const validBulkRows = useMemo(
    () => (previewRows ? previewRows.filter((r) => r.isValid) : []),
    [previewRows]
  );

  const handleImportBulk = async () => {
    if (!previewRows || validBulkRows.length === 0) {
      onNotify('error', 'ไม่มีข้อมูลที่ถูกต้องสำหรับการนำเข้า');
      return;
    }
    setBulkSaving(true);
    try {
      const payload = validBulkRows.map((r) => ({
        number: r.number,
        name: r.name,
        className: r.className,
      }));
      const res = await api.createStudentsBulk(payload);
      onStudentsChanged([...students, ...res.items]);
      onNotify('success', `นำเข้านักเรียนสำเร็จ ${res.count} คน`);
      setBulkText('');
      setPreviewRows(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'นำเข้าข้อมูลล้มเหลว');
    } finally {
      setBulkSaving(false);
    }
  };

  const openConfirm = (title: string, description: string, action: () => Promise<void>) => {
    setConfirmState({ open: true, title, description, action });
  };

  const executeConfirm = async () => {
    if (!confirmState.action) return;
    setConfirmLoading(true);
    try {
      await confirmState.action();
      setConfirmState({ open: false, title: '', description: '', action: null });
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'add'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          <span>แท็บ 1: เพิ่มนักเรียน</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bulk')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'bulk'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>แท็บ 2: เพิ่มหลายคน (Bulk Import)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('manage');
            setManageSelectedIds([]);
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'manage'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <School className="h-4 w-4" />
          <span>แท็บ 3: จัดการชั้น</span>
        </button>
      </div>

      {/* Tab 1: Add/Edit Single Student */}
      {activeTab === 'add' && (
        <form
          onSubmit={handleSaveOne}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {editingStudent ? `แก้ไขข้อมูล: ${editingStudent.name}` : 'เพิ่มนักเรียนรายบุคคล'}
            </h2>
            {editingStudent && (
              <button
                type="button"
                onClick={() => {
                  setEditingStudent(null);
                  setNumberInput('');
                  setNameInput('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="stu-number" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                เลขที่ (ไม่บังคับ)
              </label>
              <input
                id="stu-number"
                type="number"
                min={1}
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                placeholder="เช่น 1"
                className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="stu-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ชื่อ-สกุล <span className="text-rose-500">*</span>
              </label>
              <input
                id="stu-name"
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="เช่น เด็กชายสมชาย ใจดี"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="stu-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ชั้นเรียน <span className="text-rose-500">*</span>
              </label>
              <select
                id="stu-class"
                required
                value={classInput}
                onChange={(e) => setClassInput(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLASS_LIST.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingOne}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
              style={{
                backgroundColor: editingStudent ? 'var(--theme-secondary)' : 'var(--theme-primary)',
              }}
            >
              {editingStudent ? <RefreshCw className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>{savingOne ? 'กำลังบันทึก...' : editingStudent ? 'อัปเดต' : 'บันทึก'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Bulk Import from Excel */}
      {activeTab === 'bulk' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              นำเข้าข้อมูลนักเรียนหลายคนจาก Excel
            </h2>
            <ol className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-slate-600 dark:text-slate-400">
              <li className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <span className="font-semibold text-slate-900 dark:text-slate-100">1. เตรียมคอลัมน์</span>
                <p className="mt-1">เรียง 3 คอลัมน์: เลขที่ | ชื่อ-สกุล | ชั้นเรียน</p>
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <span className="font-semibold text-slate-900 dark:text-slate-100">2. คัดลอกและวาง</span>
                <p className="mt-1">คัดลอกจาก Excel แล้ววางลงในกล่องข้อความด้านล่าง</p>
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <span className="font-semibold text-slate-900 dark:text-slate-100">3. ดูตัวอย่าง</span>
                <p className="mt-1">กดปุ่ม &ldquo;ดูตัวอย่าง&rdquo; เพื่อตรวจสอบชื่อและชั้นเรียนอัตโนมัติ</p>
              </li>
              <li className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
                <span className="font-semibold text-slate-900 dark:text-slate-100">4. นำเข้าข้อมูล</span>
                <p className="mt-1">กด &ldquo;นำเข้า&rdquo; เพื่อบันทึกข้อมูลทั้งหมดพร้อมกัน</p>
              </li>
            </ol>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="bulk-student-paste" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                วางข้อมูลจาก Excel (คั่นด้วย Tab หรือจุลภาค)
              </label>
              <button
                type="button"
                onClick={() => {
                  setBulkText(
                    `เลขที่\tชื่อ-สกุล\tชั้นเรียน\n1\tสมชาย ใจดี\tป.5/1\n2\tสมหญิง รักเรียน\tป.5/1\n3\tธนกฤต แสนสุข\tป.5/2`
                  );
                  setPreviewRows(null);
                }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                ใส่ข้อมูลตัวอย่าง
              </button>
            </div>
            <textarea
              id="bulk-student-paste"
              rows={5}
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setPreviewRows(null);
              }}
              placeholder={`1\tสมชาย ใจดี\tป.5/1\n2\tสมหญิง รักเรียน\tป.5/1`}
              className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePreviewBulk}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>ดูตัวอย่าง</span>
            </button>

            {previewRows && (
              <button
                type="button"
                onClick={handleImportBulk}
                disabled={bulkSaving || validBulkRows.length === 0}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                <Upload className="h-4 w-4" />
                <span>
                  {bulkSaving
                    ? 'กำลังนำเข้า...'
                    : `นำเข้า (${validBulkRows.length} รายการ)`}
                </span>
              </button>
            )}
          </div>

          {previewRows && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  ถูกต้อง {validBulkRows.length} รายการ
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4" />
                  พบข้อผิดพลาด {previewRows.length - validBulkRows.length} รายการ
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">เลขที่</th>
                      <th className="px-4 py-2.5">ชื่อ-สกุล</th>
                      <th className="px-4 py-2.5">ชั้นเรียน</th>
                      <th className="px-4 py-2.5">ผลการตรวจสอบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={
                          row.isValid
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-rose-50/70 dark:bg-rose-950/30'
                        }
                      >
                        <td className="px-4 py-2 font-mono-num text-xs">
                          {row.numberRaw || '-'}
                        </td>
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                          {row.name || <span className="text-rose-500">(ว่าง)</span>}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                          {row.className || <span className="text-rose-500">(ว่าง)</span>}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              พร้อมนำเข้า
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {row.errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Class Management */}
      {activeTab === 'manage' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor="manage-class-select" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                เลือกชั้นเรียน:
              </label>
              <select
                id="manage-class-select"
                value={manageClass}
                onChange={(e) => {
                  setManageClass(e.target.value);
                  setManageSelectedIds([]);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLASS_LIST.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
              <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                ทั้งหมด {manageClassStudents.length} คน
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setManageSelectedIds(manageClassStudents.map((s) => s.id))}
                disabled={manageClassStudents.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>เลือกทั้งหมด</span>
              </button>
              <button
                type="button"
                onClick={() => setManageSelectedIds([])}
                disabled={manageSelectedIds.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                <span>ยกเลิก</span>
              </button>

              <button
                type="button"
                disabled={manageSelectedIds.length === 0}
                onClick={() =>
                  openConfirm(
                    'ยืนยันการลบนักเรียนที่เลือก',
                    `ต้องการลบนักเรียนที่เลือกจำนวน ${manageSelectedIds.length} คน ออกจากชั้น ${manageClass} หรือไม่?`,
                    async () => {
                      await api.bulkDeleteStudents(manageSelectedIds);
                      const delSet = new Set(manageSelectedIds);
                      onStudentsChanged(students.filter((s) => !delSet.has(s.id)));
                      onNotify('success', `ลบนักเรียนที่เลือก ${manageSelectedIds.length} คนแล้ว`);
                      setManageSelectedIds([]);
                    }
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>ลบที่เลือก ({manageSelectedIds.length})</span>
              </button>

              <button
                type="button"
                disabled={manageClassStudents.length === 0}
                onClick={() =>
                  openConfirm(
                    `ยืนยันการลบนักเรียนทั้งชั้น ${manageClass}`,
                    `ต้องการลบรายชื่อนักเรียนทั้งหมด ${manageClassStudents.length} คนในชั้น ${manageClass} หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
                    async () => {
                      await api.deleteStudentsByClass(manageClass);
                      onStudentsChanged(students.filter((s) => s.className !== manageClass));
                      onNotify('success', `ลบรายชื่อนักเรียนทั้งชั้น ${manageClass} เรียบร้อยแล้ว`);
                      setManageSelectedIds([]);
                    }
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>ลบทั้งชั้น</span>
              </button>
            </div>
          </div>

          {manageClassStudents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              ไม่มีนักเรียนในชั้น {manageClass}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {manageClassStudents.map((stu) => {
                const checked = manageSelectedIds.includes(stu.id);
                return (
                  <label
                    key={stu.id}
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'border-rose-400 bg-rose-50/60 dark:border-rose-700 dark:bg-rose-950/40'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setManageSelectedIds((prev) =>
                          checked ? prev.filter((id) => id !== stu.id) : [...prev, stu.id]
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400 w-6">
                      {stu.number ?? '-'}
                    </span>
                    <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {stu.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Full Students Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              ตารางรายชื่อนักเรียน
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              แสดง {filteredStudents.length} จาก {students.length} คน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="ค้นหาชื่อนักเรียน..."
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={tableClassFilter}
              onChange={(e) => setTableClassFilter(e.target.value)}
              aria-label="กรองตามชั้นเรียน"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทุกชั้นเรียน</option>
              {CLASS_LIST.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            ไม่พบข้อมูลนักเรียนตามเงื่อนไขที่ค้นหา
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 w-20">เลขที่</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3 w-28">ชั้น</th>
                  <th className="px-6 py-3 text-right w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-2.5 font-mono-num text-xs text-slate-600 dark:text-slate-400">
                      {stu.number ?? '-'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {stu.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {stu.className}
                    </td>
                    <td className="px-6 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(stu)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-colors"
                        title="แก้ไข"
                        aria-label={`แก้ไข ${stu.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openConfirm(
                            'ยืนยันการลบนักเรียน',
                            `ต้องการลบ "${stu.name}" (${stu.className}) ออกจากระบบหรือไม่?`,
                            async () => {
                              await api.deleteStudent(stu.id);
                              onStudentsChanged(students.filter((s) => s.id !== stu.id));
                              onNotify('success', `ลบข้อมูล ${stu.name} แล้ว`);
                            }
                          )
                        }
                        className="ml-1 inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                        title="ลบ"
                        aria-label={`ลบ ${stu.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        loading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmState({ open: false, title: '', description: '', action: null })}
      />
    </div>
  );
}
