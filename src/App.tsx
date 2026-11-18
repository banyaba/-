import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Table2,
  GraduationCap,
  BookOpen,
  FileBarChart2,
  Settings,
  Monitor,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  DEFAULT_USAGE_TYPES,
  type AppSettings,
  type PageId,
  type Student,
  type Subject,
  type UsageLog,
  type UserRole,
} from './types';
import { api } from './api/client';
import { AdminLoginModal } from './components/AdminLoginModal';
import { DashboardView } from './components/DashboardView';
import { AddDataView } from './components/AddDataView';
import { DataTableView } from './components/DataTableView';
import { StudentsView } from './components/StudentsView';
import { SubjectsView } from './components/SubjectsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ToastContainer, type ToastItem } from './components/Toast';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
  { id: 'add-data', label: 'เพิ่มข้อมูล', icon: PlusCircle },
  { id: 'data-table', label: 'ตารางข้อมูล', icon: Table2 },
  { id: 'students', label: 'นักเรียน', icon: GraduationCap, adminOnly: true },
  { id: 'subjects', label: 'รายวิชา', icon: BookOpen, adminOnly: true },
  { id: 'reports', label: 'รายงาน', icon: FileBarChart2, adminOnly: true },
  { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings, adminOnly: true },
];

export default function App() {
  const [role, setRole] = useState<UserRole>(() => {
    const saved = sessionStorage.getItem('lab_role');
    return saved === 'admin' ? 'admin' : 'user';
  });
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('lab_dark_mode') === 'true';
  });

  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [usageTypes, setUsageTypes] = useState<string[]>([...DEFAULT_USAGE_TYPES]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [editingLog, setEditingLog] = useState<UsageLog | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('lab_dark_mode', String(darkMode));
  }, [darkMode]);

  // Apply customizable theme CSS variables safely for light/dark modes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', settings.colors.primary);
    root.style.setProperty('--theme-accent', settings.colors.accent);
    root.style.setProperty('--theme-secondary', settings.colors.secondary);
    if (darkMode) {
      root.style.setProperty('--theme-surface', '#111827');
      root.style.setProperty('--theme-text', '#f1f5f9');
    } else {
      root.style.setProperty('--theme-surface', settings.colors.surface);
      root.style.setProperty('--theme-text', settings.colors.text);
    }
  }, [settings.colors, darkMode]);

  const loadDatabase = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.bootstrap();
      setStudents(data.students);
      setSubjects(data.subjects);
      setLogs(data.logs);
      setUsageTypes(data.usageTypes || [...DEFAULT_USAGE_TYPES]);
      setSettings(data.settings);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลระบบได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);

  const visibleNavItems = useMemo(() => {
    if (role === 'admin') return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => !item.adminOnly);
  }, [role]);

  // Guard admin-only routes if role is 'user'
  useEffect(() => {
    if (role === 'user') {
      const current = NAV_ITEMS.find((i) => i.id === activePage);
      if (current?.adminOnly) {
        setActivePage('add-data');
      }
    }
  }, [role, activePage]);

  const handleSwitchToAdmin = () => {
    sessionStorage.setItem('lab_role', 'admin');
    setRole('admin');
    setAdminModalOpen(false);
    notify('success', 'เข้าสู่ระบบในสิทธิ์ผู้ดูแลระบบ (Admin) สำเร็จ');
  };

  const handleExitAdmin = () => {
    sessionStorage.removeItem('lab_role');
    setRole('user');
    setEditingLog(null);
    setMobileMenuOpen(false);
    notify('success', 'สลับกลับสู่โหมดผู้ใช้งานทั่วไป (User) แล้ว');
  };

  const handleNavigate = (page: PageId) => {
    if (page !== 'add-data' && editingLog) {
      setEditingLog(null);
    }
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const currentNav = NAV_ITEMS.find((i) => i.id === activePage) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-[var(--theme-text)] transition-colors">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                <Monitor className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  ห้องคอมพิวเตอร์
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {settings.schoolName}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="ปิดเมนู"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav Links */}
          <nav aria-label="เมนูหลัก" className="p-3 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={isActive ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
            <div className="font-medium text-slate-700 dark:text-slate-200">
              สิทธิ์: {role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (User)'}
            </div>
            <div>ปีการศึกษา {settings.academicYear}</div>
          </div>
          {role === 'admin' ? (
            <button
              type="button"
              onClick={handleExitAdmin}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>ออกจากสิทธิ์ Admin</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setAdminModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>เข้าสู่ระบบ Admin</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="เปิดเมนูนำทาง"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">{settings.schoolName}</span>
                <span aria-hidden="true">/</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  {currentNav.label}
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {role === 'user' && (
              <button
                type="button"
                onClick={() => setAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">เข้าสู่ระบบ Admin</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              aria-label="สลับโหมดมืด/สว่าง"
              title="สลับโหมดมืด/สว่าง"
            >
              {darkMode ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
              <span className="hidden sm:inline">{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('add-data')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              <PlusCircle className="h-4 w-4" />
              <span>บันทึกการใช้</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] animate-pulse"
                  />
                ))}
              </div>
              <div className="h-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] animate-pulse" />
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-[var(--theme-surface)] p-8 text-center">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{loadError}</p>
              <button
                type="button"
                onClick={loadDatabase}
                className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardView
                  role={role}
                  logs={logs}
                  students={students}
                  subjects={subjects}
                  academicYear={settings.academicYear}
                  onNavigate={handleNavigate}
                />
              )}

              {activePage === 'add-data' && (
                <AddDataView
                  role={role}
                  students={students}
                  subjects={subjects}
                  usageTypes={usageTypes}
                  defaultRecorder={settings.labManager}
                  editingLog={editingLog}
                  onCancelEdit={() => setEditingLog(null)}
                  onLogSaved={(saved, isEdit) => {
                    if (isEdit) {
                      setLogs((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
                      setEditingLog(null);
                    } else {
                      setLogs((prev) => [saved, ...prev]);
                    }
                  }}
                  onBatchSaved={(createdItems) => {
                    setLogs((prev) => [...createdItems, ...prev]);
                  }}
                  onUsageTypesChanged={setUsageTypes}
                  onNotify={notify}
                />
              )}

              {activePage === 'data-table' && (
                <DataTableView
                  role={role}
                  logs={logs}
                  subjects={subjects}
                  onEditLog={(log) => {
                    setEditingLog(log);
                    setActivePage('add-data');
                  }}
                  onLogsChanged={setLogs}
                  onNotify={notify}
                />
              )}

              {activePage === 'students' && role === 'admin' && (
                <StudentsView
                  students={students}
                  onStudentsChanged={setStudents}
                  onNotify={notify}
                />
              )}

              {activePage === 'subjects' && role === 'admin' && (
                <SubjectsView
                  subjects={subjects}
                  onSubjectsChanged={setSubjects}
                  onNotify={notify}
                />
              )}

              {activePage === 'reports' && role === 'admin' && (
                <ReportsView logs={logs} settings={settings} onNotify={notify} />
              )}

              {activePage === 'settings' && role === 'admin' && (
                <SettingsView
                  settings={settings}
                  usageTypes={usageTypes}
                  counts={{
                    logs: logs.length,
                    students: students.length,
                    subjects: subjects.length,
                  }}
                  onSettingsUpdated={setSettings}
                  onUsageTypesChanged={setUsageTypes}
                  onClearLogsOnly={() => setLogs([])}
                  onClearAllData={() => {
                    setLogs([]);
                    setStudents([]);
                    setSubjects([]);
                  }}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </main>
      </div>

      <AdminLoginModal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onSuccess={handleSwitchToAdmin}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
