# Storyteller — Database Architecture

Use Supabase PostgreSQL.

Use UUID primary keys and proper foreign keys.

## Core Tables

```text
profiles
roles
clients
packages
package_items
quotations
quotation_items
invoices
payments
jobs
job_requirements
job_assignments
production_notes
file_links
editing_tasks
reviews
revisions
deliveries
activity_logs
```

## Entity Relationships

```text
profiles
   │
   ├── quotations
   ├── jobs
   ├── job_assignments
   ├── editing_tasks
   └── activity_logs

clients
   │
   ├── quotations
   ├── invoices
   └── jobs

packages
   │
   └── package_items

quotations
   │
   ├── quotation_items
   └── invoices

invoices
   │
   └── payments

jobs
   │
   ├── job_requirements
   ├── job_assignments
   ├── production_notes
   ├── file_links
   ├── editing_tasks
   ├── reviews
   ├── revisions
   └── deliveries
```

## Common Columns

Most operational tables should use:

```sql
id uuid primary key
created_at timestamptz
updated_at timestamptz
```

Use `created_by` / `updated_by` where meaningful.

## Profiles

Suggested fields:

```text
id
auth_user_id
full_name
email
phone
role_id
avatar_url
is_active
created_at
updated_at
```

## Clients

```text
id
name
company_name
phone
email
address
notes
created_by
created_at
updated_at
```

## Packages

```text
id
name
description
base_price
is_active
created_at
updated_at
```

Initial packages:

- Basic
- Premium
- Gold

## Quotations

```text
id
quotation_number
client_id
package_id
created_by
event_type
event_date
event_start_time
event_end_time
event_location
subtotal
discount
total
deposit_amount
balance_amount
status
expiry_date
terms
created_at
updated_at
```

Suggested status:

```text
DRAFT
SENT
ACCEPTED
REJECTED
EXPIRED
CONVERTED
```

## Invoices

```text
id
invoice_number
quotation_id
client_id
total_amount
deposit_amount
balance_amount
payment_status
created_at
updated_at
```

## Payments

```text
id
invoice_id
payment_type
amount
status
verified_by
verified_at
payment_reference
notes
created_at
updated_at
```

Payment types:

```text
DEPOSIT
BALANCE
```

Payment statuses:

```text
PENDING
VERIFIED
REJECTED
```

## Jobs

```text
id
job_number
client_id
quotation_id
invoice_id
event_type
event_date
event_start_time
event_end_time
event_location
package_id
status
created_by
created_at
updated_at
```

## Job Requirements

```text
id
job_id
role
quantity
notes
```

Example:

```text
VIDEOGRAPHER × 2
VIDEO_EDITOR × 1
```

## Job Assignments

```text
id
job_id
user_id
role
status
claimed_at
confirmed_at
completed_at
created_at
updated_at
```

## File Links

```text
id
job_id
file_type
name
url
description
created_by
created_at
```

File types:

```text
RAW
PROJECT
PREVIEW
FINAL
```

## Editing Tasks

```text
id
job_id
editor_id
status
started_at
preview_ready_at
completed_at
notes
created_at
updated_at
```

## Reviews

```text
id
job_id
review_type
status
submitted_at
approved_at
notes
created_at
updated_at
```

## Revisions

```text
id
job_id
review_id
requested_by
notes
status
completed_at
created_at
updated_at
```

## Deliveries

```text
id
job_id
delivered_by
final_file_url
delivered_at
notes
created_at
updated_at
```

## Activity Logs

```text
id
user_id
job_id
entity_type
entity_id
action
description
metadata
created_at
```

Every important workflow transition should create an activity log.

## Database Constraints

The videographer one-job-per-day rule should be enforced at database level where practical.

Do not rely solely on frontend validation.
