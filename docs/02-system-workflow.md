# Storyteller — System Workflow

## Complete Workflow

```text
SALESMAN
   ↓
FIND / CREATE CLIENT
   ↓
CREATE QUOTATION
   ↓
CLIENT DECISION
   ├── REJECTED
   └── ACCEPTED
          ↓
       INVOICE
          ↓
    DEPOSIT PENDING
          ↓
    MANAGER CHECKS BANK
       ├── NOT RECEIVED
       └── VERIFIED
              ↓
         JOB RELEASED
              ↓
       MANAGER SETS UP JOB
              ↓
        TEAM ASSIGNMENT
          ├── VIDEOGRAPHER
          └── VIDEO EDITOR
              ↓
          PRODUCTION
              ↓
        RAW FILES READY
              ↓
          GOOGLE DRIVE
              ↓
           EDITING
              ↓
       WATERMARK PREVIEW
              ↓
       SALESMAN REVIEWS
              ↓
         CLIENT REVIEW
          ├── REVISION
          │     ↓
          │   EDITING
          │
          └── APPROVED
                ↓
        REQUEST BALANCE
                ↓
      MANAGER CHECKS BANK
                ↓
        BALANCE VERIFIED
                ↓
        FINAL PREPARATION
                ↓
       REMOVE WATERMARK
                ↓
        FINAL UPLOAD
                ↓
       SALESMAN DELIVERS
                ↓
            COMPLETED
```

## Sales

1. Find or create client.
2. Enter event details.
3. Select Basic, Premium, or Gold package.
4. Add optional services, discounts, and notes.
5. Generate quotation.
6. Send quotation to client.
7. If rejected, keep quotation as historical record.
8. If accepted, convert quotation into invoice.

## Deposit Verification

Payment is manually verified.

The system must never assume that an invoice is paid because the client says they have paid.

```text
DEPOSIT_PENDING
      ↓
MANAGER CHECKS BANK
      ↓
DEPOSIT_VERIFIED
```

Store:

- Verified by
- Verification timestamp
- Payment reference if available
- Manager note

## Job Assignment

After deposit verification:

1. Job becomes releasable.
2. Manager defines required roles.
3. Job is published to eligible freelancers.
4. Freelancer claims the job.
5. Manager can confirm or manage the assignment.

## Production

Videographer completes the event assignment and provides the raw Google Drive folder/link.

## Editing

Editor accesses raw footage, works on the project, and provides a watermarked preview.

## Client Review

Salesman presents the watermarked preview to the client.

Client can:

- Approve
- Request revision

Revisions should be tracked rather than overwriting history.

## Final Payment

After client approval:

1. Salesman requests balance.
2. Manager checks bank manually.
3. Manager verifies balance.
4. Final production can be released.

## Delivery

After balance verification:

1. Editor prepares final version.
2. Watermark is removed.
3. Final file is uploaded.
4. Salesman delivers to client.
5. Job becomes completed.
