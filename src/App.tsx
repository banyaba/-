import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
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
  Database,
  LogIn,
  KeyRound,
  Lock,
  UserCheck,
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
import { auth, googleProvider } from './firebase/config';
import {
  checkIsAdminUser,
  seedInitialFirestoreIfEmpty,
  subscribeLabDatabase,
  subscribeSecurityPins,
} from './firebase/firestoreService';
import {
  getCachedPinHashes,
  getDefaultPinHashes,
  verifyPin6,
  type PinHashes,
} from './firebase/pinAuth';
import { AdminLoginModal } from './components/AdminLoginModal';
import { PinCodeInput } from './components/PinCodeInput';
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
  iconClass: string;
  activeGradient: string;
  headerTint: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'add-data',
    label: 'บันทึกใช้งาน',
    icon: PlusCircle,
    iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400',
    activeGradient: 'linear-gradient(135deg, #2563eb, #4f46e5)',
    headerTint: 'from-blue-600 to-indigo-600',
  },
  {
    id: 'dashboard',
    label: 'หน้าหลัก',
    icon: LayoutDashboard,
    iconClass: 'bg-violet-50 text-violet-600 dark:bg-violet-950/70 dark:text-violet-400',
    activeGradient: 'linear-gradient(135deg, #6366f1, #7c3aed)',
    headerTint: 'from-indigo-600 to-violet-600',
  },
  {
    id: 'data-table',
    label: 'ตารางข้อมูล',
    icon: Table2,
    iconClass: 'bg-teal-50 text-teal-600 dark:bg-teal-950/70 dark:text-teal-400',
    activeGradient: 'linear-gradient(135deg, #0d9488, #059669)',
    headerTint: 'from-teal-600 to-emerald-600',
  },
  {
    id: 'students',
    label: 'นักเรียน',
    icon: GraduationCap,
    adminOnly: true,
    iconClass: 'bg-sky-50 text-sky-600 dark:bg-sky-950/70 dark:text-sky-400',
    activeGradient: 'linear-gradient(135deg, #0284c7, #0891b2)',
    headerTint: 'from-sky-600 to-cyan-600',
  },
  {
    id: 'subjects',
    label: 'รายวิชา',
    icon: BookOpen,
    adminOnly: true,
    iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400',
    activeGradient: 'linear-gradient(135deg, #f59e0b, #ea580c)',
    headerTint: 'from-amber-500 to-orange-600',
  },
  {
    id: 'reports',
    label: 'รายงาน',
    icon: FileBarChart2,
    adminOnly: true,
    iconClass: 'bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400',
    activeGradient: 'linear-gradient(135deg, #e11d48, #db2777)',
    headerTint: 'from-rose-600 to-pink-600',
  },
  {
    id: 'settings',
    label: 'ตั้งค่าระบบ',
    icon: Settings,
    adminOnly: true,
    iconClass: 'bg-purple-50 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400',
    activeGradient: 'linear-gradient(135deg, #9333ea, #c026d3)',
    headerTint: 'from-purple-600 to-fuchsia-600',
  },
];

function formatErrorForDisplay(raw: string): string {
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed?.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          return 'ไม่มีสิทธิ์ดำเนินการในส่วนนี้ หรือบัญชีไม่ได้รับอนุญาต';
        }
        return `ไม่สามารถเชื่อมต่อฐานข้อมูล (${parsed.error})`;
      }
    } catch {
      // ignore JSON parse error
    }
  }
  return raw;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sessionUnlocked, setSessionUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('lab_session_unlocked') === 'true';
  });
  const [role, setRole] = useState<UserRole>(() => {
    return sessionStorage.getItem('lab_role') === 'admin' ? 'admin' : 'user';
  });
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [pinHashes, setPinHashes] = useState<PinHashes | null>(() => getCachedPinHashes());
  const [loginMethod, setLoginMethod] = useState<'pin6' | 'google'>('pin6');
  const [pinInput, setPinInput] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('lab_dark_mode') === 'true';
  });

  const [activePage, setActivePage] = useState<PageId>('add-data');
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
    const cleanMessage = type === 'error' ? formatErrorForDisplay(message) : message;
    setToasts((prev) => [...prev, { id, type, message: cleanMessage }]);
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

  // Ensure default PIN hashes are resolved when cache is empty
  useEffect(() => {
    if (!pinHashes) {
      void getDefaultPinHashes().then((defaults) => setPinHashes(defaults));
    }
  }, [pinHashes]);

  // Listen to optional Firebase Auth state (never blocks direct Firestore connection)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const adminFlag = await checkIsAdminUser(user);
          if (adminFlag && sessionStorage.getItem('lab_google_login') === '1') {
            sessionStorage.removeItem('lab_google_login');
            sessionStorage.setItem('lab_role', 'admin');
            sessionStorage.setItem('lab_session_unlocked', 'true');
            setRole('admin');
            setSessionUnlocked(true);
          } else if (sessionStorage.getItem('lab_google_login') === '1') {
            sessionStorage.removeItem('lab_google_login');
            sessionStorage.setItem('lab_role', 'user');
            sessionStorage.setItem('lab_session_unlocked', 'true');
            setRole('user');
            setSessionUnlocked(true);
          }
        } catch {
          // Ignore optional Google admin lookup errors
        }
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to custom 6-digit PIN hashes from Firestore immediately (no Google login required)
  useEffect(() => {
    if (!authReady) return;
    const unsubPins = subscribeSecurityPins((hashes) => {
      setPinHashes(hashes);
    });
    return () => unsubPins();
  }, [authReady]);

  // Seed initial data if empty & attach real-time Firestore listeners directly without requiring Google sign-in
  useEffect(() => {
    if (!authReady) return;

    let active = true;
    let unsubscribeDb: (() => void) | null = null;
    setLoading(true);
    setLoadError(null);

    const startSync = async () => {
      try {
        await seedInitialFirestoreIfEmpty();
        if (!active) return;

        let loadedSettings = false;
        let loadedStudents = false;
        let loadedSubjects = false;
        let loadedLogs = false;

        const maybeFinishLoading = () => {
          if (loadedSettings && loadedStudents && loadedSubjects && loadedLogs) {
            setLoading(false);
          }
        };

        unsubscribeDb = subscribeLabDatabase({
          onSettings: (nextSettings, nextUsageTypes) => {
            if (!active) return;
            setSettings(nextSettings);
            setUsageTypes(nextUsageTypes);
            loadedSettings = true;
            maybeFinishLoading();
          },
          onStudents: (nextStudents) => {
            if (!active) return;
            setStudents(nextStudents);
            loadedStudents = true;
            maybeFinishLoading();
          },
          onSubjects: (nextSubjects) => {
            if (!active) return;
            setSubjects(nextSubjects);
            loadedSubjects = true;
            maybeFinishLoading();
          },
          onLogs: (nextLogs) => {
            if (!active) return;
            setLogs(nextLogs);
            loadedLogs = true;
            maybeFinishLoading();
          },
          onError: (err) => {
            if (!active) return;
            setLoadError(formatErrorForDisplay(err.message));
            setLoading(false);
          },
        });
      } catch (err) {
        if (!active) return;
        setLoadError(
          formatErrorForDisplay(
            err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อฐานข้อมูล Firebase ได้'
          )
        );
        setLoading(false);
      }
    };

    void startSync();

    return () => {
      active = false;
      if (unsubscribeDb) unsubscribeDb();
    };
  }, [authReady]);

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

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      sessionStorage.setItem('lab_google_login', '1');
      await signInWithPopup(auth, googleProvider);
      notify('success', 'เข้าสู่ระบบด้วยบัญชี Google สำเร็จ');
    } catch (err) {
      sessionStorage.removeItem('lab_google_login');
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบ Google ได้';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('ยกเลิกการเข้าสู่ระบบ กรุณากดเข้าสู่ระบบด้วย Google อีกครั้ง');
      } else {
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handlePin6Login = async (candidatePin: string) => {
    if (pinVerifying) return;
    if (candidatePin.length !== 6) {
      setPinError('กรุณากรอกตัวเลขให้ครบ 6 หลัก');
      return;
    }

    setPinVerifying(true);
    setPinError(null);
    setAuthError(null);

    try {
      const matchedRole = await verifyPin6(candidatePin, pinHashes);
      if (!matchedRole) {
        setPinError('รหัสตัวเลข 6 หลักไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        setPinInput('');
        return;
      }

      sessionStorage.setItem('lab_role', matchedRole);
      sessionStorage.setItem('lab_session_unlocked', 'true');
      setRole(matchedRole);
      setSessionUnlocked(true);
      setPinInput('');
      setPinError(null);
      notify(
        'success',
        matchedRole === 'admin'
          ? 'เข้าสู่ระบบด้วยเลข 6 หลัก (Admin) สำเร็จ'
          : 'เข้าสู่ระบบด้วยเลข 6 หลัก (User) สำเร็จ'
      );
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'ไม่สามารถตรวจสอบรหัสได้');
    } finally {
      setPinVerifying(false);
    }
  };

  const handlePasswordlessUserEnter = () => {
    setPinError(null);
    setAuthError(null);
    sessionStorage.setItem('lab_role', 'user');
    sessionStorage.setItem('lab_session_unlocked', 'true');
    setRole('user');
    setSessionUnlocked(true);
    setPinInput('');
    notify('success', 'เข้าใช้งานในสิทธิ์ผู้ใช้งานทั่วไป (User) สำเร็จ');
  };

  const handleLockScreen = () => {
    sessionStorage.removeItem('lab_session_unlocked');
    setPinInput('');
    setPinError(null);
    setAuthError(null);
    setLoginMethod('pin6');
    setMobileMenuOpen(false);
    setSessionUnlocked(false);
  };

  const handleGoogleSignOut = async () => {
    try {
      sessionStorage.removeItem('lab_role');
      sessionStorage.removeItem('lab_session_unlocked');
      sessionStorage.removeItem('lab_google_login');
      setSessionUnlocked(false);
      setPinInput('');
      setPinError(null);
      await signOut(auth);
      setEditingLog(null);
      setMobileMenuOpen(false);
      notify('success', 'ออกจากระบบบัญชี Google เรียบร้อยแล้ว');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ไม่สามารถออกจากระบบได้');
    }
  };

  const handleSwitchToAdmin = () => {
    sessionStorage.setItem('lab_role', 'admin');
    sessionStorage.setItem('lab_session_unlocked', 'true');
    setRole('admin');
    setSessionUnlocked(true);
    setAdminModalOpen(false);
    notify('success', 'เข้าสู่ระบบในสิทธิ์ผู้ดูแลระบบ (Admin) สำเร็จ');
  };

  const handleExitAdmin = () => {
    sessionStorage.setItem('lab_role', 'user');
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

  // Wait for initial Firebase readiness
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-slate-300">
          <div className="h-9 w-9 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">กำลังเชื่อมต่อฐานข้อมูล Firebase...</span>
        </div>
      </div>
    );
  }

  // Login / Lock Screen (6-digit PIN + Passwordless User entry + Optional Google Sign-In)
  if (!sessionUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50/70 to-emerald-50/60 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xl shadow-blue-900/5 dark:shadow-none space-y-5">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))' }}
            >
              <Monitor className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                ระบบบันทึกการใช้ห้องคอมพิวเตอร์
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เชื่อมต่อฐานข้อมูล Cloud Firestore โดยตรง (ไม่ต้องใช้บัญชี Google)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('pin6');
                setAuthError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                loginMethod === 'pin6'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>เลข 6 หลัก (PIN)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('google');
                setPinError(null);
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                loginMethod === 'google'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Google (ไม่บังคับ)</span>
            </button>
          </div>

          {loginMethod === 'pin6' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handlePin6Login(pinInput);
              }}
              className="space-y-4"
            >
              <PinCodeInput
                value={pinInput}
                onChange={(next) => {
                  setPinInput(next);
                  setPinError(null);
                }}
                onComplete={(completed) => {
                  void handlePin6Login(completed);
                }}
                disabled={pinVerifying}
                autoFocus
                label="กรอกรหัสเข้าสู่ระบบ 6 หลัก"
              />

              {pinError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300 text-center"
                >
                  {pinError}
                </div>
              )}

              <button
                type="submit"
                disabled={pinVerifying || pinInput.length !== 6}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-55"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                <KeyRound className="h-4 w-4" />
                <span>{pinVerifying ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบด้วยเลข 6 หลัก'}</span>
              </button>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={pinVerifying}
                  onClick={handlePasswordlessUserEnter}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-55 transition-colors"
                >
                  <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>เข้าใช้งานทั่วไป (User) โดยไม่ต้องใส่รหัส</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                  <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>เชื่อมต่อบัญชี Google (ตัวเลือกเสริม)</span>
                </div>
                <p className="leading-relaxed">
                  ระบบสามารถเชื่อมต่อ Cloud Firestore ได้ทันทีด้วยรหัส 6 หลักหรือสิทธิ์ User โดยไม่ต้องยืนยันบัญชี Google หรือเลือกเข้าสู่ระบบด้วย Google เพิ่มเติมได้ที่นี่
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300"
                >
                  {authError}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                <LogIn className="h-4 w-4" />
                <span>{signingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}</span>
              </button>
            </div>
          )}
        </div>

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  const ActiveNavIcon = currentNav.icon;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50/25 to-violet-50/25 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/15 text-[var(--theme-text)] transition-colors">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-200/80 dark:border-slate-800 bg-[var(--theme-surface)] flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-transparent dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-transparent">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))' }}
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
          <nav aria-label="เมนูหลัก" className="p-3 space-y-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-white shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={isActive ? { background: item.activeGradient } : undefined}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isActive ? 'bg-white/20 text-white' : item.iconClass
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5 bg-slate-50/60 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {firebaseUser?.displayName ||
                firebaseUser?.email ||
                (role === 'admin' ? 'ผู้ดูแลระบบห้องคอมพิวเตอร์' : 'ผู้ใช้งานทั่วไป (User)')}
            </div>
            <div className="text-[11px] flex items-center gap-1.5">
              <span>สิทธิ์:</span>
              <span
                className={
                  role === 'admin'
                    ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                    : 'font-semibold text-emerald-600 dark:text-emerald-400'
                }
              >
                {role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (User)'}
              </span>
            </div>
            <div>ปีการศึกษา {settings.academicYear}</div>
          </div>

          {role === 'admin' ? (
            <button
              type="button"
              onClick={handleExitAdmin}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
              <span>สลับเป็นสิทธิ์ User</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setAdminModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/70 dark:bg-indigo-950/40 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>เข้าสู่ระบบ Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLockScreen}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>ล็อกหน้าจอ (รหัส 6 หลัก)</span>
          </button>

          {firebaseUser && (
            <button
              type="button"
              onClick={handleGoogleSignOut}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/60 dark:bg-rose-950/30 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>ออกจากระบบ Google</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 bg-[var(--theme-surface)]/95 backdrop-blur-xs px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="เปิดเมนูนำทาง"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div
              className={`hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${currentNav.headerTint} text-white shadow-xs`}
            >
              <ActiveNavIcon className="h-4.5 w-4.5" />
            </div>

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
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/50 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="h-4 w-4" />
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
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
              <span className="hidden sm:inline">{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('add-data')}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))' }}
            >
              <PlusCircle className="h-4 w-4" />
              <span>บันทึกใช้งาน</span>
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
                onClick={() => window.location.reload()}
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
                  pinHashes={pinHashes}
                  counts={{
                    logs: logs.length,
                    students: students.length,
                    subjects: subjects.length,
                  }}
                  onSettingsUpdated={setSettings}
                  onUsageTypesChanged={setUsageTypes}
                  onPinHashesChanged={setPinHashes}
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
        pinHashes={pinHashes}
        onClose={() => setAdminModalOpen(false)}
        onSuccess={handleSwitchToAdmin}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
