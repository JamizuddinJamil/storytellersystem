# Storyteller — Project Overview

## 1. Purpose

Storyteller is an internal production management system for an event videography/media company.

The system connects the sales process with production operations, freelancers, video editing, client review, payment verification, and final delivery.

The application must be workflow-driven rather than a collection of disconnected CRUD pages.

## 2. Primary Goals

- Centralize client and job information.
- Standardize quotation and invoice workflow.
- Prevent production work from starting before deposit verification.
- Simplify freelancer job claiming.
- Prevent videographers from accepting multiple jobs on the same day.
- Allow editors to manage multiple editing jobs.
- Track raw footage and final files through Google Drive links.
- Track client review and revisions.
- Prevent final delivery before balance payment verification.
- Provide role-specific dashboards.
- Maintain a clear audit trail.

## 3. Technology

### Frontend
- Vue.js 3
- Vite
- Vue Router
- Pinia
- Tailwind CSS

### Backend
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage only where appropriate

### Infrastructure
- Cloudflare Pages
- Cloudflare-compatible deployment

### PWA
The application must be installable and mobile-first.

## 4. Core Roles

- Manager
- Salesman
- Videographer
- Video Editor

## 5. Core Principle

Every important business action should move the record from one valid state to another.

```text
Quotation Accepted
      ↓
Invoice Created
      ↓
Deposit Verified
      ↓
Job Released
      ↓
Team Assigned
      ↓
Production
      ↓
Raw Files Ready
      ↓
Editing
      ↓
Preview
      ↓
Client Approval
      ↓
Balance Verified
      ↓
Final Delivery
      ↓
Completed
```

## 6. Initial Scope

Phase 1 should establish:

- Project setup
- PWA foundation
- Supabase connection
- Authentication
- User profiles
- Roles
- Database schema
- RLS
- Role-based routing
- Basic dashboards
- Basic clients
- Basic jobs
- Workflow status architecture

Do not build advanced integrations yet.
