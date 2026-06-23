# PropReview — Proposal Review Application

A production-ready MVP for reviewing RFPs, meeting transcripts, and customer documents. Built with **Next.js 16 + TypeScript + Tailwind CSS v4** and uses the browser's **IndexedDB** (via Dexie.js) for zero-backend data persistence.

## Features

- **Proposal Intake Wizard** — 3-step form: Basic Info → Upload Documents → Review & Submit
- **Optional Document Uploads** — Separate drag-and-drop zones for RFPs, transcripts, and customer documents
- **IndexedDB Storage** — All proposals, documents, comments, and scores persist locally
- **Demo Data** — 4 sample proposals are seeded automatically on first load
- **Review Workspace** — Editable summary, 5-dimension scorecard, team comments, approve/reject/request actions
- **Document Viewer** — Sidebar file list + preview for text and images with download links
- **Dashboard & Proposal List** — Stats cards, search, filters, grid/list toggle
- **Admin Settings** — Roles, categories, integrations placeholders, backup/export, and data reset

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Local DB:** Dexie.js (IndexedDB)
- **Utilities:** clsx + tailwind-merge

## Getting Started

Open the `proposal-review-app` folder in VS Code, then run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
proposal-review-app/
├── app/                    # Next.js App Router pages
│   ├── dashboard/
│   ├── proposals/
│   │   ├── new/
│   │   └── [id]/
│   │       ├── documents/
│   │       └── review/
│   └── settings/
├── components/
│   ├── ui/                 # Reusable UI primitives
│   ├── layout/             # Shell, sidebar, navbar
│   ├── file-upload.tsx     # Drag-and-drop upload component
│   └── proposal-form.tsx   # Intake wizard
├── lib/
│   ├── db.ts               # Dexie/IndexedDB data layer
│   ├── types.ts            # Shared TypeScript types
│   ├── demo-data.ts        # Seed data
│   └── utils.ts            # cn, formatters
```

## Migration Path to Production Backend

When you are ready to connect a real datasource:

1. Replace `lib/db.ts` with a Prisma/PostgreSQL (or MongoDB) client.
2. Add API routes under `app/api/` for CRUD operations.
3. Move file storage from base64-in-IndexedDB to S3 / MinIO / Azure Blob.
4. Add authentication (e.g. NextAuth.js or Clerk) and wire role checks.

The UI components and page structure can remain largely unchanged.

## Notes

- Large binary files (PDF, DOCX) are stored as base64 in IndexedDB. For production, migrate to object storage.
- Text extraction currently works for plain-text files. PDF/DOCX parsing can be added later with libraries like `pdf-parse` or `mammoth`.
