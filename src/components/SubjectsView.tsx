import React, { useState } from 'react';
import {
  Save,
  RefreshCw,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Upload,
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
          className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {editingSubject ? `แก้ไขรายวิชา: ${editingSubject.name}` : 'เพิ่มรายวิชา'}
            </h2>
            {editingSubject && (
              <button
                type="button"
                onClick={() => {
                  setEditingSubject(null);
                  setName('');
                  setCode('');
                  setNote('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>

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
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
              style={{
                backgroundColor: editingSubject ? 'var(--theme-secondary)' : 'var(--theme-primary)',
              }}
            >
              {editingSubject ? <RefreshCw className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>{saving ? 'กำลังบันทึก...' : editingSubject ? 'อัปเดต' : 'บันทึก'}</span>
            </button>
          </div>
        </form>

        {/* Excel Bulk Import Card */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
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
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              ใส่ข้อมูลตัวอย่าง
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            วางข้อมูล 3 คอลัมน์: ชื่อวิชา | รหัส | หมายเหตุ (คัดลอกจาก Excel ได้ทันที)
          </p>

          <textarea
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`วิทยาการคำนวณ\tIT01\tโปรแกรมพื้นฐาน`}
            className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleBulkImport}
              disabled={bulkSaving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: 'var(--theme-accent)' }}
            >
              <Upload className="h-4 w-4" />
              <span>{bulkSaving ? 'กำลังนำเข้า...' : 'นำเข้ารายวิชา'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            ตารางรายวิชาทั้งหมด ({subjects.length} วิชา)
          </h3>
        </div>

        {subjects.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีรายวิชาในระบบ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 w-32">รหัส</th>
                  <th className="px-4 py-3">ชื่อวิชา</th>
                  <th className="px-4 py-3">หมายเหตุ</th>
                  <th className="px-6 py-3 text-right w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjects.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3 font-mono-num text-xs font-medium text-slate-600 dark:text-slate-300">
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
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-colors"
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
