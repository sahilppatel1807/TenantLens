---
name: tenantlens-nextjs-supabase
description: Full-stack development for TenantLens, a SaaS platform that helps real estate agents review and compare rental applicants using Next.js, TypeScript, TailwindCSS, and Supabase.
---

# TenantLens Development Skill

You are an expert full-stack developer building TenantLens, a production-ready SaaS application for real estate agencies to review and compare rental applicants.

The system is a decision-support tool, not a complex AI platform. Focus on clarity, simplicity, and real-world usability.

You use:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth, Postgres, Storage)
- Vercel deployment

You always follow best practices for clean architecture, maintainability, and production readiness.

---

## Product Understanding

TenantLens helps real estate agents:

- identify missing application information
- review applicant documents efficiently
- compare multiple applicants quickly
- reduce manual follow-ups
- make faster, clearer decisions

This is NOT an AI-heavy system. Avoid unnecessary complexity.

---

## Core Features

- Property management (create, view, select properties)
- Applicant management per property
- Document upload and tracking
- Completeness detection (missing documents)
- Income evaluation relative to property rent
- Rental history summary
- Scoring system (out of 100)
- Tier classification (Good / Average / Bad)
- Dashboard ranking applicants
- Applicant detail view

---

## Scoring System

Total score = 100

- Completeness = 50
- Income = 30
- Rental History = 20

Income must be evaluated relative to property weekly rent:

- >= 3x rent → strong
- 2x–3x rent → medium
- < 2x rent → weak

Always return:
- total score
- category breakdown
- tier classification

Tier rules:
- Good: 75+
- Average: 50–74
- Bad: <50

Scoring logic must be centralized in `lib/scoring`.

---

## Technical Preferences

- Use Next.js App Router structure (`app/`)
- Prefer React Server Components by default
- Use `'use client'` only when necessary
- Use Supabase for all backend needs
- Keep TypeScript strict and well-typed
- Use Tailwind CSS consistently
- Use reusable components
- Use semantic HTML

---

## UI Guidelines

- Clean, minimal, professional design
- Inspired by real estate listing interfaces
- Top navigation only (no heavy sidebar)
- Property card at top of dashboard
- Applicant cards below
- Group applicants by tier

Each applicant card must show:
- name
- score
- tier
- short summary

Clicking applicant must show:
- submitted documents
- missing documents
- full summary

---

## Architecture Guidelines

- Keep UI and business logic separate
- Store reusable logic in `lib/`
- Keep components in `components/`
- Use clear file structure
- Avoid monolithic files

---

## Supabase Usage

### Auth
- Implement login/register using Supabase Auth
- Protect dashboard routes

### Database
- Use structured tables:
  - properties
  - applicants
  - applicant_documents
  - analysis_results

### Storage
- Use Supabase Storage for document uploads
- Store metadata in database

---

## Refactoring rules (legacy UI)

- Preserve existing UI and layout unless the task explicitly calls for a redesign
- Remove all mock/demo data
- Replace local state with real backend logic
- Remove unnecessary dependencies
- Clean and simplify structure
- Do not redesign unnecessarily

---

## Implementation Order

Always build in this order:

1. Project structure setup (Next.js App Router)
2. Supabase Auth
3. Properties CRUD
4. Applicants CRUD
5. Document uploads
6. Scoring logic
7. Dashboard data integration
8. Applicant detail view
9. Validation and error handling
10. Deployment readiness

---

## Coding Standards

- Use kebab-case for component filenames
- Use descriptive variable names
- Avoid magic numbers (use constants)
- Keep functions small and focused
- Ensure code is production-ready (no placeholders)

---

## What NOT to Do

- Do NOT introduce unnecessary AI features
- Do NOT over-engineer the system
- Do NOT redesign UI unnecessarily
- Do NOT mix mock and real data
- Do NOT add complex state management (Redux, etc.)

---

## Goal

Build a production-ready MVP that:

- reduces manual effort for agents
- improves clarity of rental applications
- enables quick comparison of applicants
- works reliably with real backend data