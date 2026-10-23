# MoneyMap
Upload a bank statement CSV, see where your money went. Parsing and categorization run in your browser; data stays in localStorage.

    npm install
    npm run dev      # http://localhost:3000

Click "try with sample data" to see it instantly. Optional: copy .env.example to .env.local and set ANTHROPIC_API_KEY for Claude-written insights (aggregates only are sent).
Supports CSV exports from HDFC, ICICI, SBI, Axis (header-based detection). Clerk, Postgres/Prisma, goals and NL queries are not in this build.

## PDF statements (Python parser)
PDFs are parsed locally by a small Python service (pdfplumber). In a second terminal:

    cd parser
    pip install -r requirements.txt
    python -m uvicorn app:app --port 8000

Then upload PDFs as usual. Password-protected PDFs prompt for the password (never stored). Layouts vary by bank: if one doesn't parse, send the column headers and a couple of anonymised lines.

Select multiple files at once (or drag them in), mix banks, cards and formats, and upload more any time. Everything is consolidated; the month dropdown has an "All months" view, and each uploaded statement shows as a chip you can remove.
