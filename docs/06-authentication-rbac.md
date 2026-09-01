# Storyteller — Authentication & RBAC

## Authentication

Use Supabase Auth.

Initial authentication:

- Email
- Password

Flow:

```text
Login
  ↓
Supabase Auth
  ↓
Load Profile
  ↓
Load Role
  ↓
Role-Based Router
  ↓
Dashboard
```

## Role-Based Access

Roles:

```text
MANAGER
SALESMAN
VIDEOGRAPHER
VIDEO_EDITOR
```

Do not trust a role stored only in localStorage or Pinia.

The database must be the source of truth.

## Route Guards

Example:

```text
/manager/*
/sales/*
/videographer/*
/editor/*
```

Unauthorised users should be redirected.

## Permission Matrix

| Action | Manager | Salesman | Videographer | Editor |
|---|---:|---:|---:|---:|
| View dashboard | ✓ | ✓ | ✓ | ✓ |
| Manage clients | ✓ | ✓ | Limited | Limited |
| Create quotation | ✓ | ✓ | ✗ | ✗ |
| Manage invoice | ✓ | ✓ | ✗ | ✗ |
| Verify deposit | ✓ | ✗ | ✗ | ✗ |
| Verify balance | ✓ | ✗ | ✗ | ✗ |
| Create job | ✓ | Limited | ✗ | ✗ |
| Manage assignments | ✓ | ✗ | ✗ | ✗ |
| Claim videography job | ✗ | ✗ | ✓ | ✗ |
| Claim editing job | ✗ | ✗ | ✗ | ✓ |
| Update production | ✓ | ✗ | ✓ | ✗ |
| Update editing | ✓ | ✗ | ✗ | ✓ |
| Client review workflow | ✓ | ✓ | ✗ | Limited |
| Final delivery | ✓ | ✓ | ✗ | ✗ |

"Limited" permissions should be defined explicitly during implementation.

## RLS

Every sensitive table must have RLS enabled.

Examples:

- Salesman only accesses permitted sales/client/job records.
- Videographer accesses eligible jobs and their own assignments.
- Editor accesses eligible editing tasks and their own assignments.
- Manager has operational management access.

Never use frontend-only permission checks for sensitive operations.
