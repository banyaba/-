# Firestore Security Specification

## 1. Data Invariants
1. **Authentication & Verification**: No unauthenticated or unverified email client may read, list, create, update, or delete any document in `students`, `subjects`, `logs`, `settings`, or `admins`.
2. **Identity Ownership & Immutability**: Every created document in `students`, `subjects`, `logs`, and `settings` must set `ownerId == request.auth.uid`, and `ownerId` and `createdAt` can never be changed on `update`.
3. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time` (enforced via `serverTimestamp()`).
4. **Role Segregation (Admin vs General User)**:
   - Only Admins (`isAdmin()`) may create/update/delete `students` and `subjects`, delete `logs`, or modify school info / theme `colors` in `settings/app`.
   - General verified Users may read school-scoped collections (`visibility == 'school'`), create and edit `logs`, and add/rename `usageTypes` without shrinking/deleting options.
5. **Strict Schema & Size Guards**: Every document uses `keys().hasAll(...) && keys().hasOnly(...)`, strict regexes (`className`, `date`, `colors`), bounded strings, and bounded arrays (`usageTypes.size() <= 30` / `50`).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated List**: `getDocs(collection(db, 'logs'))` with `auth == null`.
2. **Unverified Email Write**: `setDoc(doc(db, 'logs', 'log_1'), validLog)` when `email_verified == false`.
3. **Shadow Ghost Field Injection**: `setDoc` on `logs` with extra `"isAdmin": true` field.
4. **Identity Spoofing on Create**: `setDoc` on `logs` where `ownerId` != `request.auth.uid`.
5. **Owner Hijack on Update**: `updateDoc` on `logs` attempting to change `ownerId`.
6. **CreatedAt Tampering**: `setDoc` on `logs` with a client string timestamp instead of `request.time`.
7. **ID Poisoning**: `setDoc` on `/logs/${'a'.repeat(300)}` or `/logs/bad$id`.
8. **Invalid Class Pattern**: `setDoc` on `students` or `logs` with `className: "ม.1/1"`.
9. **Array Overflow / Type Poisoning**: `setDoc` on `logs` with 31 items in `usageTypes` or `usageTypes: [123]`.
10. **Non-Admin Student Mutation**: Non-admin user attempting to `create` or `delete` a `students` document.
11. **Non-Admin Log Deletion**: Non-admin user attempting `deleteDoc(doc(db, 'logs', 'log_1'))`.
12. **Non-Admin Settings Color Tampering**: Non-admin user attempting to update `schoolName` or `colors` in `settings/app`, or shrink `usageTypes`.
