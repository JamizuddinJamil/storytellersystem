# Storyteller — Development Roadmap

## Phase 1 — Foundation

Build first:

- Vue.js + Vite project
- Tailwind CSS
- PWA foundation
- Supabase client
- Supabase Auth
- User profiles
- Role system
- Database schema
- RLS policies
- Vue Router
- Pinia
- Role-based layouts
- Mobile navigation
- Desktop sidebar
- Basic dashboards

### Phase 1 Acceptance Criteria

A user can:

1. Register/login.
2. Have a role assigned.
3. Be redirected to the correct dashboard.
4. See only role-appropriate navigation.
5. Access Supabase data according to RLS.
6. Install the PWA.

---

## Phase 2 — Clients & Sales

Build:

- Client management
- Package management
- Package items
- Quotations
- Quotation status
- Quotation acceptance
- Invoice generation
- Sales dashboard

Workflow:

```text
Client
 ↓
Quotation
 ↓
Accepted
 ↓
Invoice
```

---

## Phase 3 — Payment & Jobs

Build:

- Payment records
- Deposit verification
- Manager verification UI
- Job creation
- Job release
- Job requirements
- Production briefing
- Activity logs

Workflow:

```text
Invoice
 ↓
Deposit Pending
 ↓
Manager Verification
 ↓
Job Released
```

---

## Phase 4 — Freelancer Assignment

Build:

- Available jobs
- Job claiming
- Videographer availability
- One-job-per-day enforcement
- Editor workload
- Assignment management
- Manager confirmation

---

## Phase 5 — Production

Build:

- Production dashboard
- Event details
- Production briefing
- Assignment status
- Raw file submission
- Google Drive folder links

---

## Phase 6 — Editing

Build:

- Editing queue
- Editor workload
- Editing status
- Preview links
- Revision workflow
- Final file links

---

## Phase 7 — Client Review & Payment

Build:

- Client review status
- Revision requests
- Client approval
- Balance payment request
- Manager balance verification
- Final release control

---

## Phase 8 — Delivery

Build:

- Final delivery
- Delivery records
- Delivery links
- Completion status
- Job history
- Production analytics

---

## Phase 9 — Future Enhancements

Possible future features:

- Google Drive API integration
- WhatsApp notifications
- Email notifications
- Push notifications
- Client portal
- Online payment integration
- Automated invoice PDF
- Automated quotation PDF
- Calendar
- Freelancer ratings
- Performance analytics
- Revenue dashboard
- Advanced reporting

These should not be implemented in Phase 1.

---

# Initial Development Instruction

When starting development, do NOT attempt to build the entire system.

Start with Phase 1 only.

First produce:

1. Architecture
2. Folder structure
3. Database schema
4. SQL migrations
5. RLS policies
6. Authentication
7. Role system
8. Vue routes
9. Role layouts
10. Basic responsive dashboards
11. PWA configuration

Then test the foundation before proceeding to Phase 2.
