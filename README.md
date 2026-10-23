# MoneyMap

**Upload any bank statement and instantly understand where your money went.**

MoneyMap is a personal financial intelligence dashboard. Drop in statements (CSV, Excel or PDF) from different banks and cards, and get one consolidated view of income, spending, subscriptions and savings. No manual entry, no accounts to link.

It is not a budgeting app and not an accounting tool. It is built for a quick, clear answer to *"where did my money go this month?"*

> Parsing and categorization run on your own machine. Statements are never uploaded to a third-party server.

<!-- Add screenshots here, e.g. ![Dashboard](docs/dashboard.png) -->

---

## Features

- **Multi-file, multi-bank upload.** Select many files at once or add them over time. Mix banks, cards and formats, and everything is consolidated.
- **CSV, Excel and PDF statements.** Header-based detection for CSV and Excel. A local Python service parses PDFs, including password-protected ones.
- **Automatic categorization.** Rule-based engine covering Food, Transport, Shopping, Rent, Bills, Healthcare, Investment, Entertainment, Travel, Fitness, Education, Software, Subscriptions and Other.
- **Dashboard.** Income, expenses, savings and savings rate, with a month selector and an "All months" view.
- **Spending breakdown.** Interactive donut chart with hover and legend highlighting.
- **Monthly trends.** Spending and savings over 3M, 6M, 12M or all time.
- **"Where did my salary go?"** Animated flow from income through each category to savings.
- **Subscription detector.** Finds recurring charges and shows monthly and yearly cost.
- **AI insights (optional).** Spending leaks, unusual spends, subscription review, savings opportunities and a monthly summary, written by Claude. A built-in local insight engine is used when no API key is set.
- **Transaction explorer.** Search, sort (newest or largest) and paginate.
- **Duplicate-safe.** Re-uploading overlapping statements does not double count.
- **Source management.** Each uploaded statement appears as a chip and can be removed individually.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 3.4, dark-mode-first design system |
| Charts | Recharts 2.15 |
| CSV parsing | PapaParse |
| Excel parsing | SheetJS (`xlsx`), loaded on demand in the browser |
| PDF parsing | Python, FastAPI, Uvicorn, pdfplumber |
| AI (optional) | Anthropic Messages API, called from a Next.js route handler |
| Storage | Browser `localStorage` (no database in this version) |

---

## Architecture

```
Browser (Next.js client)                         Local Python service (optional)
┌──────────────────────────────────────┐        ┌───────────────────────────┐
│ Upload (1..n files)                  │  PDF   │ FastAPI  POST /parse      │
│   ├─ CSV   → PapaParse               │ ─────► │  pdfplumber text extract  │
│   ├─ Excel → SheetJS → CSV → parser  │ ◄───── │  line/amount heuristics   │
│   └─ PDF   → fetch(parser)           │  rows  │  password handling        │
│                                      │        └───────────────────────────┘
│ Normalize → Categorize → Dedupe      │
│   ├─ summarize() → monthly totals    │        Next.js route handler
│   ├─ detectSubs() → subscriptions    │        ┌───────────────────────────┐
│   └─ localInsights()                 │ ─────► │ POST /api/insights        │
│                                      │ aggreg.│  → Anthropic API (opt.)   │
│ State persisted in localStorage      │ only   └───────────────────────────┘
└──────────────────────────────────────┘
```

### Pipeline

1. **Parse** the file into raw rows of `{date, description, amount, type}`.
2. **Normalize** the merchant name from the description (strips UPI/NEFT/POS prefixes, reference numbers and handles).
3. **Categorize** using an ordered list of regex rules. First match wins.
4. **Dedupe** against what is already loaded using the key `date | amount | type | merchant`.
5. **Aggregate** into per-month summaries that drive the dashboard, charts and insights.

### Project structure

```
moneymap/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                # Dashboard UI (client component)
│  │  ├─ layout.tsx
│  │  ├─ globals.css             # Tailwind + animations
│  │  └─ api/insights/route.ts   # Optional Claude insights endpoint
│  └─ lib/
│     └─ engine.ts               # Parsing, categorization, summaries,
│                                # subscription detection, local insights
├─ parser/
│  ├─ app.py                     # FastAPI PDF statement parser
│  └─ requirements.txt
├─ .env.example
├─ tailwind.config.ts
└─ package.json
```

---

## Getting started

### Prerequisites

- Node.js 18.18 or newer
- Python 3.9 or newer (only needed for PDF statements)

### 1. Run the web app

```bash
npm install
npm run dev
```

Open http://localhost:3000. Click **try with sample data** to see the dashboard immediately, or upload your own statements.

### 2. Enable PDF parsing (optional)

In a second terminal:

```bash
cd parser
pip install -r requirements.txt
python -m uvicorn app:app --port 8000
```

The app talks to `http://localhost:8000/parse` by default. Password-protected PDFs prompt for the password in the browser. It is sent only to your local parser and is never stored.

### 3. Enable Claude insights (optional)

```bash
cp .env.example .env.local
# then set ANTHROPIC_API_KEY in .env.local
```

Without a key, the app uses its built-in local insight engine.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Enables Claude-written insights via `/api/insights` |
| `NEXT_PUBLIC_PARSER_URL` | No | Override the PDF parser URL (default `http://localhost:8000/parse`) |

---

## Supported statements

| Format | How it is read |
|---|---|
| **CSV** | Finds the header row automatically (skips preamble). Detects date, description, debit, credit, a combined amount column or a Debit/Credit indicator column. |
| **Excel (.xlsx/.xls)** | First sheet is converted to CSV in the browser, then parsed the same way. |
| **PDF** | Extracted server-side by pdfplumber. Rows are lines starting with a date and ending in amounts. |

Date formats handled include `13/10/2026`, `13-Oct-2026`, `13 Oct '26` and `2026-10-13`.

Development was tested against HDFC and Axis credit card statements and a PNB savings account statement. Layouts vary by bank and change over time, so some PDFs may need parser tweaks.

### How PDF debit/credit direction is decided

In priority order:

1. An explicit `Dr` / `Cr` suffix on the amount.
2. A `+` sign before the amount.
3. The change in running balance versus the previous row (or the opening balance).
4. Keywords such as `CREDIT`, `SALARY`, `REFUND`, `CASHBACK`, `RECEIVED`.

---

## How the numbers are calculated

- **Income** is the sum of credits, excluding transfers and refunds.
- **Expenses** are debits excluding transfers and investments.
- **Savings** is income minus expenses (investment debits therefore count as saved).
- **Transfers** such as credit card bill payments, self-transfers and CRED bill payments are excluded from both income and expenses, so paying a card bill is not counted on top of the card's own purchases.
- **Refunds and cashback** credits are ignored in totals.

### Subscription detection

A merchant is flagged as a subscription when:

- it has at least 3 charges (2 for well-known services such as Netflix, Spotify or OpenAI),
- every amount is within 10% of the median amount, and
- every gap between charges is 30 days, plus or minus 5.

Yearly cost is the median amount times 12.

---

## Privacy and security

- Statements are parsed in the browser, or by a parser service running on your own machine.
- Parsed transactions are stored only in your browser's `localStorage`. Use **Clear** in the app to remove them.
- If you enable Claude insights, only **aggregated** figures (monthly totals, category totals, detected subscriptions) are sent. Raw transactions, descriptions and account numbers are not.
- The repo's `.gitignore` excludes `.env` files and all `.pdf`, `.xlsx`, `.xls` and `.csv` files, to prevent committing real statements.
- No
