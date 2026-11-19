import React, { useState } from 'react';
import {
  Save,
  RefreshCw,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Upload,
  BookOpen,
} from 'lucide-react';
import type { Subject } from '../types';
import { api } from '../api/client';
import { ConfirmModal } from './ConfirmModal';

interface SubjectsViewProps {
  subjects: Subject[];
  onSubjectsChanged: (next: Subject[]) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function SubjectsView({
  subjects,
  onSubjectsChanged,
  onNotify,
}: SubjectsViewProps) {
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Excel Bulk Import
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onNotify('error', 'กรุณากรอกชื่อวิชา');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        note: note.trim(),
      };
      if (editingSubject) {
        const updated = await api.updateSubject(editingSubject.id, payload);
        onSubjectsChanged(subjects.map((s) => (s.id === updated.id ? updated : s)));
        onNotify('success', `อัปเดตวิชา ${updated.name} เรียบร้อยแล้ว`);
        setEditingSubject(null);
      } else {
        const created = await api.createSubject(payload);
        onSubjectsChanged([...subjects, created]);
        onNotify('success', `เพิ่มวิชา ${created.name} เรียบร้อยแล้ว`);
      }
      setName('');
      setCode('');
      setNote('');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลวิชาได้');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      onNotify('error', 'กรุณาวางข้อมูลรายวิชาจาก Excel');
      return;
    }

    const items: Omit<Subject, 'id' | 'createdAt'>[] = [];
    lines.forEach((line, idx) => {
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.split(',').map((p) => p.trim());
      if (idx === 0 && (parts[0] === 'ชื่อวิชา' || parts[1] === 'รหัส')) return;
      if (!parts[0]) return;
      items.push({
        name: parts[0],
        code: parts[1] || '',
        note: parts[2] || '',
      });
    });

    if (items.length === 0) {
      onNotify('error', 'ไม่พบชื่อวิชาที่ถูกต้องในข้อมูลที่วาง');
      return;
    }

    setBulkSaving(true);
    try {
      const res = await api.createSubjectsBulk(items);
      onSubjectsChanged([...subjects, ...res.items]);
      onNotify('success', `นำเข้ารายวิชาสำเร็จ ${res.count} วิชา`);
      setBulkText('');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'นำเข้ารายวิชาล้มเหลว');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSubject(deleteTarget.id);
      onSubjectsChanged(subjects.filter((s) => s.id !== deleteTarget.id));
      onNotify('success', `ลบรายวิชา ${deleteTarget.name} เรียบร้อยแล้ว`);
      setDeleteTarget(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ลบรายวิชาไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-amber-100/80 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-transparent dark:from-amber-950/40 dark:via-orange-950/30 dark:to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs shrink-0">
                <BookOpen className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editingSubject ? `แก้ไขรายวิชา: ${editingSubject.name}` : 'เพิ่มรายวิชาใหม่'}
              </h2>
            </div>
            {editingSubject && (
              <button
                type="button"
                onClick={() => {
                  setEditingSubject(null);
                  setName('');
                  setCode('');
                  setNote('');
                }}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
              >
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="sub-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ชื่อวิชา <span className="text-rose-500">*</span>
              </label>
              <input
                id="sub-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น วิทยาการคำนวณ"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sub-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  รหัส (ไม่บังคับ)
                </label>
                <input
                  id="sub-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="เช่น IT01"
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="sub-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input
                  id="sub-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น โปรแกรมพื้นฐาน"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
                style={{
                  backgroundColor: editingSubject ? 'var(--theme-secondary)' : 'var(--theme-primary)',
                }}
              >
                {editingSubject ? <RefreshCw className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                <span>{saving ? 'กำลังบันทึก...' : editingSubject ? 'อัปเดต' : 'บันทึก'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Excel Bulk Import Card */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-emerald-100/80 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-transparent dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs shrink-0">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                นำเข้าจาก Excel
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setBulkText(
                  `ชื่อวิชา\tรหัส\tหมายเหตุ\nวิทยาการคำนวณ\tIT01\tโปรแกรมพื้นฐาน\nออกแบบและเทคโนโลยี\tIT02\tโครงงานคอมพิวเตอร์`
                )
              }
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              ใส่ข้อมูลตัวอย่าง
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              วางข้อมูล 3 คอลัมน์: ชื่อวิชา | รหัส | หมายเหตุ (คัดลอกจาก Excel ได้ทันที)
            </p>

            <textarea
              rows={4}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`วิทยาการคำนวณ\tIT01\tโปรแกรมพื้นฐาน`}
              className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={bulkSaving}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: 'var(--theme-accent)' }}
              >
                <Upload className="h-4 w-4" />
                <span>{bulkSaving ? 'กำลังนำเข้า...' : 'นำเข้ารายวิชา'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100/80 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-transparent dark:from-amber-950/35 dark:via-orange-950/25 dark:to-transparent">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs shrink-0">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              ตารางรายวิชาทั้งหมด ({subjects.length} วิชา)
            </h3>
          </div>
        </div>

        {subjects.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีรายวิชาในระบบ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-transparent dark:from-amber-950/35 dark:via-orange-950/25 dark:to-transparent text-xs font-semibold text-amber-900 dark:text-amber-200 border-b border-amber-100 dark:border-amber-900/50">
                <tr>
                  <th className="px-6 py-3 w-32">รหัส</th>
                  <th className="px-4 py-3">ชื่อวิชา</th>
                  <th className="px-4 py-3">หมายเหตุ</th>
                  <th className="px-6 py-3 text-right w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors">
                    <td className="px-6 py-3 font-mono-num text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {sub.code || '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {sub.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {sub.note || '-'}
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubject(sub);
                          setName(sub.name);
                          setCode(sub.code || '');
                          setNote(sub.note || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700 dark:text-slate-400 dark:hover:bg-amber-950/60 dark:hover:text-amber-300 transition-colors"
                        title="แก้ไข"
                        aria-label={`แก้ไข ${sub.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(sub)}
                        className="ml-1 inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                        title="ลบ"
                        aria-label={`ลบ ${sub.name}`}
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
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบรายวิชา"
        description={`ต้องการลบรายวิชา "${deleteTarget?.name || ''}" ออกจากระบบหรือไม่?`}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
