"""Local PDF statement parser. Run: uvicorn app:app --port 8000"""
import io, re
from datetime import date
import pdfplumber
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])

MON = "jan feb mar apr may jun jul aug sep oct nov dec".split()
DATE = re.compile(r"^(\d{1,2})[/\-. ]([A-Za-z]{3}|\d{1,2})[A-Za-z]*[/\-. ,']*(\d{2,4})\b")
DATE_ANY = re.compile(r"\b\d{1,2}(?:[/-]\d{1,2}[/-]\d{2,4}|[/\- ][A-Za-z]{3}[a-z]*[ ,'-]*'?\d{2,4})\b")
AMT = re.compile(r"(?<![\d.,/-])(\d{1,3}(?:,\d{2,3})*\.\d{2}|\d+\.\d{2})(?:\s?(Dr|Cr|DR|CR)\b)?")
CREDIT_WORDS = re.compile(r"\b(CR|CREDIT|DEPOSIT|SALARY|INTEREST|REFUND|CASHBACK|REVERSAL|RECEIVED)\b", re.I)
NOISE = re.compile(r"page|statement|www\.|customer|generated|continued|closing|opening", re.I)

def iso(m):
    d, mo, y = m.group(1), m.group(2), int(m.group(3))
    mo = MON.index(mo.lower()) + 1 if mo.isalpha() and mo.lower() in MON else (int(mo) if mo.isdigit() else 0)
    y += 2000 if y < 100 else 0
    try: return date(y, mo, int(d)).isoformat()
    except ValueError: return None

def num(s): return float(s.replace(",", ""))

def extract(pdf):
    rows, prev_bal, cur = [], None, None
    for page in pdf.pages:
        for line in (page.extract_text() or "").split("\n"):
            line = line.strip()
            if re.search(r"opening balance", line, re.I):
                a = AMT.search(line)
                if a: prev_bal = num(a.group(1))
                continue
            if re.search(r"end of statement", line, re.I): cur = None; continue
            m = DATE.match(line)
            d = iso(m) if m else None
            if not d:
                if cur and len(line) < 80 and cur["_c"] < 2 and not NOISE.search(line) and not AMT.search(line):
                    cur["desc"] += " " + line; cur["_c"] += 1
                continue
            rest = DATE_ANY.sub(" ", line[m.end():]).strip()
            amts = list(AMT.finditer(rest))
            if not amts: continue
            before = rest[:amts[0].start()]
            plus = bool(re.search(r"\+\s*[^\d\s]?\s*$", before))
            desc = re.sub(r"^\|?\s*\d{2}:\d{2}\s*", "", before.strip())
            desc = re.sub(r"\s*\+?\s*[C₹]\s*$", "", desc).strip()
            bal = None
            if len(amts) >= 3 and (num(amts[-3].group(1)) == 0 or num(amts[-2].group(1)) == 0):
                a, b = amts[-3], amts[-2]; bal = num(amts[-1].group(1))
                t, amt = ("CREDIT", num(b.group(1))) if num(a.group(1)) == 0 else ("DEBIT", num(a.group(1)))
            else:
                a = amts[-2] if len(amts) >= 2 else amts[-1]
                if len(amts) >= 2: bal = num(amts[-1].group(1))
                amt, t = num(a.group(1)), None
                if plus: t = "CREDIT"
                elif a.group(2): t = "CREDIT" if a.group(2).upper() == "CR" else "DEBIT"
                elif bal is not None and prev_bal is not None:
                    if abs(prev_bal + amt - bal) < 0.02: t = "CREDIT"
                    elif abs(prev_bal - amt - bal) < 0.02: t = "DEBIT"
                if t is None: t = "CREDIT" if CREDIT_WORDS.search(desc) else "DEBIT"
            if bal is not None: prev_bal = bal
            if amt == 0: continue
            cur = {"date": d, "desc": desc, "amount": amt, "type": t, "_c": 0}
            rows.append(cur)
    return [{k: v for k, v in r.items() if k != "_c"} for r in rows]

@app.post("/parse")
async def parse_pdf(file: UploadFile = File(...), password: str = Form("")):
    data = await file.read()
    try:
        with pdfplumber.open(io.BytesIO(data), password=password or None) as pdf:
            rows = extract(pdf)
    except Exception as e:
        if "assword" in type(e).__name__ or "assword" in str(e):
            return JSONResponse({"error": "password"}, status_code=401)
        return JSONResponse({"error": f"Could not read this PDF: {e}"}, status_code=400)
    if not rows:
        return JSONResponse({"error": "No transactions recognised in this PDF. Try your bank's CSV/Excel export."}, status_code=422)
    return {"rows": rows}
