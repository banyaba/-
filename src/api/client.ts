import type { AppSettings, LabDatabase, Student, Subject, UsageLog } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `เกิดข้อผิดพลาด (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: () => request<LabDatabase>('/api/bootstrap'),

  // Logs
  createLog: (payload: Omit<UsageLog, 'id' | 'createdAt'>) =>
    request<UsageLog>('/api/logs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createLogsBatch: (items: Omit<UsageLog, 'id' | 'createdAt'>[]) =>
    request<{ count: number; items: UsageLog[] }>('/api/logs/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  updateLog: (id: string, payload: Partial<UsageLog>) =>
    request<UsageLog>(`/api/logs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteLog: (id: string) =>
    request<{ ok: boolean }>(`/api/logs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  deleteLogsByDate: (date: string) =>
    request<{ deleted: number }>(`/api/logs/by-date/${encodeURIComponent(date)}`, {
      method: 'DELETE',
    }),

  // Students
  createStudent: (payload: Omit<Student, 'id' | 'createdAt'>) =>
    request<Student>('/api/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createStudentsBulk: (items: Omit<Student, 'id' | 'createdAt'>[]) =>
    request<{ count: number; items: Student[] }>('/api/students/bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  updateStudent: (id: string, payload: Partial<Student>) =>
    request<Student>(`/api/students/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteStudent: (id: string) =>
    request<{ ok: boolean }>(`/api/students/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  bulkDeleteStudents: (ids: string[]) =>
    request<{ deleted: number }>('/api/students/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  deleteStudentsByClass: (className: string) =>
    request<{ deleted: number }>(`/api/students/class/${encodeURIComponent(className)}`, {
      method: 'DELETE',
    }),

  // Subjects
  createSubject: (payload: Omit<Subject, 'id' | 'createdAt'>) =>
    request<Subject>('/api/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createSubjectsBulk: (items: Omit<Subject, 'id' | 'createdAt'>[]) =>
    request<{ count: number; items: Subject[] }>('/api/subjects/bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  updateSubject: (id: string, payload: Partial<Subject>) =>
    request<Subject>(`/api/subjects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteSubject: (id: string) =>
    request<{ ok: boolean }>(`/api/subjects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Usage Types
  addUsageType: (name: string) =>
    request<{ usageTypes: string[] }>('/api/usage-types', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateUsageType: (index: number, name: string) =>
    request<{ usageTypes: string[] }>(`/api/usage-types/${index}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),

  deleteUsageType: (index: number) =>
    request<{ usageTypes: string[] }>(`/api/usage-types/${index}`, {
      method: 'DELETE',
    }),

  resetUsageTypes: () =>
    request<{ usageTypes: string[] }>('/api/usage-types/reset', {
      method: 'POST',
    }),

  // Settings
  updateSettings: (payload: AppSettings) =>
    request<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Bulk Data Clear
  clearUsageLogsOnly: () =>
    request<{ deletedCount: number }>('/api/data/logs', {
      method: 'DELETE',
    }),

  clearAllData: () =>
    request<{ deletedLogs: number; deletedStudents: number; deletedSubjects: number }>(
      '/api/data/all',
      {
        method: 'DELETE',
      }
    ),
};
