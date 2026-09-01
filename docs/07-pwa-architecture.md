# Storyteller — PWA Architecture

## Objective

Storyteller must behave like a mobile application while remaining a web application.

## Requirements

- Installable
- Responsive
- Fast
- Mobile-first
- Offline-friendly application shell
- Service worker
- Web app manifest
- App icons
- Splash/loading experience
- Safe-area support
- Touch-friendly controls

## Mobile Layout

Primary mobile navigation should use a bottom navigation bar where appropriate.

Example:

```text
┌─────────────────────────────┐
│ Storyteller                 │
│                             │
│ Dashboard content           │
│                             │
│                             │
├─────────────────────────────┤
│ Home │ Jobs │ Clients │ More│
└─────────────────────────────┘
```

## Desktop Layout

Use a sidebar navigation.

```text
┌────────────┬──────────────────────┐
│ Storyteller│ Dashboard            │
│            │                      │
│ Dashboard  │ Content              │
│ Jobs       │                      │
│ Clients    │                      │
│ Payments   │                      │
│ Reports    │                      │
└────────────┴──────────────────────┘
```

## Offline Strategy

The application shell should remain available when connectivity is temporarily lost.

Do not assume all business actions can work offline.

Critical operations such as:

- Payment verification
- Job claiming
- Assignment
- Workflow transitions

should require server confirmation.

## Cloudflare

Deploy the frontend through Cloudflare Pages.

Keep secrets out of the frontend.

Supabase service-role keys must never be exposed to the browser.

Only public Supabase configuration intended for client-side use may be exposed.

## Future Integrations

Architecture should allow future integration with:

- Google Drive
- WhatsApp notifications
- Email
- Push notifications
- Calendar
- Client portal
- Automated reporting
