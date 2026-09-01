# Storyteller — UI/UX Guidelines

## Design Direction

Storyteller should feel:

- Modern
- Professional
- Minimal
- Clean
- Fast
- Creative-industry appropriate
- Mobile-first

Avoid overly complex enterprise interfaces.

## Mobile First

Design for phone screens first.

Minimum considerations:

- Large touch targets
- Clear hierarchy
- Bottom navigation
- Sticky action buttons where appropriate
- Bottom sheets for quick actions
- Compact cards
- Avoid wide tables on mobile

## Desktop

On larger screens:

- Sidebar navigation
- Multi-column dashboards
- Tables where useful
- Split views for workflow management

## Status UI

Use consistent status badges.

Example:

```text
PENDING
VERIFIED
ASSIGNED
IN PRODUCTION
EDITING
REVIEW
REVISION
APPROVED
DELIVERED
```

## Important Actions

Actions should be visually obvious.

Examples:

```text
VERIFY DEPOSIT
ASSIGN JOB
ASSIGN TO ME
START EDITING
MARK COMPLETE
REQUEST BALANCE
VERIFY PAYMENT
DELIVER TO CLIENT
```

## Job Detail Page

A job page should present:

```text
JOB HEADER
    ↓
CLIENT
    ↓
EVENT DETAILS
    ↓
PACKAGE
    ↓
TEAM
    ↓
PRODUCTION BRIEF
    ↓
FILES
    ↓
EDITING
    ↓
CLIENT REVIEW
    ↓
PAYMENT
    ↓
DELIVERY
    ↓
ACTIVITY TIMELINE
```

## Dashboard Cards

Avoid displaying too much information.

Example Manager cards:

```text
12
Upcoming Jobs

3
Deposit Verification

2
Unassigned

5
Editing

1
Final Payment
```

## Forms

Forms should:

- Be short
- Group related fields
- Validate immediately
- Show clear errors
- Save safely
- Avoid unnecessary fields

## Responsive Tables

On mobile, convert complex tables into cards.

Do not force users to horizontally scroll large management tables unless absolutely necessary.
