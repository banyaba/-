/**
 * Firestore Rules Security Verification Specification (Dirty Dozen Payloads)
 * Evaluates all 12 adversarial payloads against the Eight Pillars in firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'list' | 'get' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  docId?: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated list on logs',
    collection: 'logs',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email create on logs',
    collection: 'logs',
    operation: 'create',
    docId: 'log_test_2',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: false },
    payload: {
      date: '2026-11-17',
      studentName: 'สมชาย ใจดี',
      className: 'ป.5/1',
      subjectName: 'วิทยาการคำนวณ',
      usageTypes: ['ค้นคว้าข้อมูล'],
      recorder: 'ครูเอ',
      ownerId: 'user1',
      visibility: 'school',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow ghost field injection on logs',
    collection: 'logs',
    operation: 'create',
    docId: 'log_test_3',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    payload: {
      date: '2026-11-17',
      studentName: 'สมชาย ใจดี',
      className: 'ป.5/1',
      subjectName: 'วิทยาการคำนวณ',
      usageTypes: ['ค้นคว้าข้อมูล'],
      recorder: 'ครูเอ',
      ownerId: 'user1',
      visibility: 'school',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity spoofing on create (ownerId != auth.uid)',
    collection: 'logs',
    operation: 'create',
    docId: 'log_test_4',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    payload: {
      date: '2026-11-17',
      studentName: 'สมชาย ใจดี',
      className: 'ป.5/1',
      subjectName: 'วิทยาการคำนวณ',
      usageTypes: ['ค้นคว้าข้อมูล'],
      recorder: 'ครูเอ',
      ownerId: 'other_user_uid',
      visibility: 'school',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner hijack on update',
    collection: 'logs',
    operation: 'update',
    docId: 'log_test_5',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    payload: { ownerId: 'attacker_uid' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client-provided createdAt string instead of server timestamp',
    collection: 'logs',
    operation: 'create',
    docId: 'log_test_6',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    payload: {
      date: '2026-11-17',
      createdAt: '2026-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'ID poisoning with invalid characters',
    collection: 'logs',
    operation: 'create',
    docId: 'bad$id#poison',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid class pattern outside ป.1/1 - ป.6/3',
    collection: 'students',
    operation: 'create',
    docId: 'stu_test_8',
    auth: { uid: 'admin1', email: 'banyaba@narathiwat1.go.th', email_verified: true },
    payload: { className: 'ม.1/1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'UsageTypes array overflow (> 30 items)',
    collection: 'logs',
    operation: 'create',
    docId: 'log_test_9',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    payload: {
      usageTypes: Array.from({ length: 31 }, (_, i) => `item_${i}`),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Non-admin user attempting to create student',
    collection: 'students',
    operation: 'create',
    docId: 'stu_test_10',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-admin user attempting to delete log',
    collection: 'logs',
    operation: 'delete',
    docId: 'log_test_11',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Non-admin user attempting to shrink usageTypes or change schoolName',
    collection: 'settings',
    operation: 'update',
    docId: 'app',
    auth: { uid: 'user1', email: 'teacher@school.ac.th', email_verified: true },
    payload: { schoolName: 'Hacked School', usageTypes: [] },
    expected: 'PERMISSION_DENIED',
  },
];
