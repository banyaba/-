import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, RotateCcw } from 'lucide-react';
import { api } from '../api/client';

interface UsageTypesManagerProps {
  usageTypes: string[];
  canDelete?: boolean;
  onUsageTypesChanged: (next: string[], renamed?: { oldName: string; newName: string }) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function UsageTypesManagerPanel({
  usageTypes,
  canDelete = true,
  onUsageTypesChanged,
  onNotify,
}: UsageTypesManagerProps) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      onNotify('error', 'กรุณากรอกชื่อรูปแบบการใช้');
      return;
    }
    setAdding(true);
    try {
      const res = await api.addUsageType(trimmed);
      onUsageTypesChanged(res.usageTypes);
      setNewName('');
      onNotify('success', `เพิ่มรูปแบบการใช้ "${trimmed}" เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถเพิ่มรูปแบบการใช้ได้');
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (index: number) => {
    const trimmed = editingValue.trim();
    const oldName = usageTypes[index];
    if (!trimmed) {
      onNotify('error', 'ชื่อรูปแบบการใช้ห้ามว่าง');
      return;
    }
    if (trimmed === oldName) {
      setEditingIndex(null);
      return;
    }
    setSavingEdit(true);
    try {
      const res = await api.updateUsageType(index, trimmed);
      onUsageTypesChanged(res.usageTypes, { oldName, newName: trimmed });
      setEditingIndex(null);
      onNotify('success', `แก้ไขเป็น "${trimmed}" เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถแก้ไขรูปแบบการใช้ได้');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (index: number) => {
    const targetName = usageTypes[index];
    setDeletingIdx(index);
    try {
      const res = await api.deleteUsageType(index);
      onUsageTypesChanged(res.usageTypes);
      setConfirmDeleteIdx(null);
      if (editingIndex === index) setEditingIndex(null);
      onNotify('success', `ลบรูปแบบการใช้ "${targetName}" แล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบรูปแบบการใช้ได้');
    } finally {
      setDeletingIdx(null);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await api.resetUsageTypes();
      onUsageTypesChanged(res.usageTypes);
      setConfirmReset(false);
      setEditingIndex(null);
      setConfirmDeleteIdx(null);
      onNotify('success', 'คืนค่ารูปแบบการใช้เริ่มต้น 10 รายการเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถคืนค่าเริ่มต้นได้');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="เพิ่มรูปแบบการใช้ใหม่ เช่น ตัดต่อวิดีโอ, ออกแบบกราฟิก..."
          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
          style={{ backgroundColor: 'var(--theme-primary)' }}
        >
          <Plus className="h-4 w-4" />
          <span>{adding ? 'กำลังเพิ่ม...' : 'เพิ่มตัวเลือก'}</span>
        </button>
      </form>

      {/* List */}
      {usageTypes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          ยังไม่มีตัวเลือกรูปแบบการใช้ กรุณาเพิ่มตัวเลือกด้านบน หรือกดคืนค่าเริ่มต้น
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
          {usageTypes.map((item, idx) => {
            const isEditing = editingIndex === idx;
            const isConfirmDelete = confirmDeleteIdx === idx;

            return (
              <div
                key={`${idx}-${item}`}
                className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-2.5"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-mono-num text-xs text-slate-400 w-5 shrink-0">
                    {idx + 1}.
                  </span>

                  {isEditing ? (
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit(idx);
                        } else if (e.key === 'Escape') {
                          setEditingIndex(null);
                        }
                      }}
                      autoFocus
                      className="flex-1 rounded-md border border-blue-400 bg-white dark:bg-slate-800 px-2.5 py-1 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {item}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(idx)}
                        disabled={savingEdit}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>บันทึก</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        disabled={savingEdit}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>ยกเลิก</span>
                      </button>
                    </>
                  ) : isConfirmDelete ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        disabled={deletingIdx === idx}
                        className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {deletingIdx === idx ? 'กำลังลบ...' : 'ยืนยันลบ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteIdx(null)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIndex(idx);
                          setEditingValue(item);
                          setConfirmDeleteIdx(null);
                        }}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-colors"
                        title="แก้ไข"
                        aria-label={`แก้ไข ${item}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteIdx(idx);
                            setEditingIndex(null);
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                          title="ลบ"
                          aria-label={`ลบ ${item}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Reset */}
      <div className="flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-mono-num">ทั้งหมด {usageTypes.length} ตัวเลือก</span>
        {canDelete &&
          (confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ยืนยันคืนค่า 10 รายการเริ่มต้น?
              </span>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {resetting ? 'กำลังคืนค่า...' : 'ยืนยัน'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>คืนค่าเริ่มต้น 10 รายการ</span>
            </button>
          ))}
      </div>
    </div>
  );
}

interface UsageTypesManagerModalProps extends UsageTypesManagerProps {
  open: boolean;
  onClose: () => void;
}

export function UsageTypesManagerModal({
  open,
  onClose,
  usageTypes,
  canDelete = true,
  onUsageTypesChanged,
  onNotify,
}: UsageTypesManagerModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-types-modal-title"
    >
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3
              id="usage-types-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              จัดการตัวเลือกรูปแบบการใช้
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {canDelete
                ? 'เพิ่ม แก้ไข หรือลบตัวเลือกรูปแบบการใช้ห้องคอมพิวเตอร์'
                : 'เพิ่ม หรือแก้ไขตัวเลือกรูปแบบการใช้ห้องคอมพิวเตอร์'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <UsageTypesManagerPanel
            usageTypes={usageTypes}
            canDelete={canDelete}
            onUsageTypesChanged={onUsageTypesChanged}
            onNotify={onNotify}
          />
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}
