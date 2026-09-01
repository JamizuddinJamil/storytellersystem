# Storyteller — User Roles

## Manager

### Responsibilities

- Manage production operations.
- Verify deposit payments manually.
- Verify final payments manually.
- Create and manage job requirements.
- Monitor freelancer assignments.
- Monitor editing workload.
- Monitor production progress.
- Manage production briefing.
- Monitor client review and delivery.

### Dashboard

Show:

- Jobs today
- Upcoming jobs
- Deposit verification pending
- Jobs waiting for assignment
- Unassigned jobs
- Production jobs
- Editing jobs
- Client reviews pending
- Final payments pending
- Delivery pending

---

## Salesman

### Responsibilities

- Find/create clients.
- Create quotations.
- Select packages.
- Send quotations.
- Convert accepted quotations into invoices.
- Communicate with clients.
- Show previews to clients.
- Request balance payment.
- Deliver completed files.

### Cannot

- Verify payments.
- Override payment verification.
- Bypass production workflow.

---

## Videographer

### Responsibilities

- Browse eligible jobs.
- View event details.
- Claim available jobs.
- View production briefing.
- Complete production assignment.
- Submit raw-file location.

### Critical Rule

A videographer may only have one job per calendar day.

This must be enforced at database/business-logic level.

---

## Video Editor

### Responsibilities

- Browse editing jobs.
- Claim/accept eligible editing jobs.
- Access raw footage.
- Update editing progress.
- Upload/link watermarked preview.
- Handle revisions.
- Upload/link final version.

### Workload Rule

An editor may have multiple active editing jobs.

The UI should show current workload.

---

## Role Navigation

### Manager

```text
Dashboard
Jobs
Assignments
Clients
Payments
Production
Editing
Reports
More
```

### Salesman

```text
Dashboard
Clients
Quotations
Invoices
Jobs
Reviews
Deliveries
```

### Videographer

```text
Dashboard
Available Jobs
My Jobs
Schedule
Profile
```

### Video Editor

```text
Dashboard
Available Jobs
My Jobs
Revisions
Files
Profile
```
