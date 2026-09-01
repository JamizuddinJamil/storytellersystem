# Storyteller — Business Rules

## Rule 1 — Deposit Required

A job cannot become `RELEASED` until the deposit is manually verified.

## Rule 2 — Manager Payment Verification

Only Manager can verify:

- Deposit
- Balance

## Rule 3 — One Videographer Per Day

A videographer cannot have more than one confirmed/active job on the same calendar date.

The restriction must exist in backend/database logic.

## Rule 4 — Editors Can Handle Multiple Jobs

Video editors can have multiple active editing tasks.

## Rule 5 — Watermarked Preview

All client previews must be watermarked.

## Rule 6 — Final Release

Final unwatermarked files must not be released before balance payment verification.

## Rule 7 — Revision History

Client revision requests must create revision records.

Do not overwrite previous review history.

## Rule 8 — Audit Trail

Important actions should be logged.

Examples:

```text
Quotation accepted
Invoice created
Deposit verified
Job released
Job claimed
Assignment confirmed
Production completed
Raw files submitted
Editing started
Preview uploaded
Revision requested
Client approved
Balance verified
Final uploaded
Delivered
```

## Rule 9 — Role Restrictions

Frontend visibility is not enough.

Supabase RLS must enforce access.

## Rule 10 — Large Files

Do not store large raw video files in PostgreSQL.

Use Google Drive for production media and store references/metadata in the database.

## Rule 11 — Workflow Integrity

Do not allow arbitrary status changes.

Example:

A job should not jump directly from:

```text
WAITING_DEPOSIT
      ↓
DELIVERED
```

without passing the required workflow stages.

## Rule 12 — Historical Records

Rejected quotations, cancelled assignments, revisions, payment verification history, and activity logs should remain available for audit purposes.
