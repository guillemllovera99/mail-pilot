# MailQuark — Phase 0 Setup

Run these commands in your terminal, in order. Should take about 5 minutes.

---

## 1. Create the project folder

```bash
mkdir mailquark && cd mailquark
```

---

## 2. Scaffold Next.js

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

When prompted:
- Would you like to use Turbopack? → **No**

This creates the base project. We'll overwrite its files in the next step.

---

## 3. Install dependencies

```bash
npm install next-auth@^4.24.7 @next-auth/prisma-adapter @prisma/client @microsoft/microsoft-graph-client lucide-react
npm install -D prisma
```

---

## 4. Copy the Phase 0 files into the project

From the outputs/phase0 folder, copy everything into your mailquark project root.
The file structure should look like this when done:

```
mailquark/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   └── health/
│   │       └── route.ts
│   ├── dashboard/
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/
│   └── sign-out-button.tsx
├── lib/
│   ├── auth.ts
│   └── db.ts
├── prisma/
│   └── schema.prisma
├── types/
│   └── next-auth.d.ts
├── middleware.ts
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json
```

---

## 5. Add the environment variables

Copy `.env.local` from the outputs folder into the mailquark project root.

```
mailquark/
└── .env.local   ← goes here
```

> This file contains your real secrets — never commit it to git.

---

## 6. Push the database schema

This creates all the tables in your Supabase PostgreSQL database.

```bash
npx prisma generate
npx prisma db push
```

You should see output like:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your Prisma schema.
```

---

## 7. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. Verify Phase 0 works

1. `http://localhost:3000` → should redirect to `/login`
2. Click **Sign in with Microsoft**
3. Sign in with your Microsoft account (you'll approve permissions once)
4. You should land on `/dashboard` with "Phase 0 complete ✓" and your name
5. Visit `http://localhost:3000/api/health` — should return `{"ok":true,"user":"your@email.com",...}`

---

## Before deploying to Vercel

1. Run `npm run build` locally once to catch any type errors
2. Push the project to a GitHub repo (private is fine)
3. Import it on [vercel.com](https://vercel.com) → Add New Project
4. Add all 9 env vars from `.env.local` in the Vercel dashboard
5. After deploy, update `NEXTAUTH_URL` in Vercel to your live URL, e.g. `https://mailquark.vercel.app`
6. Back in [portal.azure.com](https://portal.azure.com) → MailQuark app registration → Authentication → add redirect URI:
   `https://mailquark.vercel.app/api/auth/callback/microsoft-entra-id`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `OAuthCallbackError` | Check AZURE_CLIENT_ID and AZURE_TENANT_ID = `consumers` |
| Blank page / hydration error | Make sure `"use client"` is at top of login/page.tsx |
| `PrismaClientInitializationError` | Check DATABASE_URL in .env.local; run `npx prisma db push` again |
| Redirect loop | Make sure NEXTAUTH_URL matches where the app is running |
| 401 on /dashboard | Session not saved — check that Supabase accepts connections (test DB_PUSH) |

---

Phase 0 done. Phase 1 = Microsoft Graph email sync.
