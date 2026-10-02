# Invoice Simulator

## 1. Purpose
A small, deterministic demo app (a fake B2B invoice portal) used as a system-under-test for AI Computer Use E2E experiments.
Question: can the *same* natural-language test pass after the UI layout changes (V1 → V2) with no change to test code?
No AI, Playwright or Selenium is part of this project.

## 2. Architecture
- Node.js + Express (one dependency), `server.js`
- Static frontend in `public/index.html` (plain HTML/JS, no build step)
- Storage: in-memory + JSON file (`data/invoices.json`). Free Render instances have an ephemeral disk, so data is lost on redeploy/restart — fine for a demo.
- V1 and V2 are two renderings of the same frontend state, same API, same data.

## 3. Run locally
```
npm install
npm start        # http://localhost:3000
```
Optional: `PORT`, `DATA_DIR`. Open `/?ui=v2` to start in V2.

## 4. API
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{"status":"ok"}` |
| GET | `/api/invoices` | all invoices |
| GET | `/api/invoices/{id}` | one invoice (404 if missing) |
| POST | `/api/invoices` | create. Body: `customer, invoiceNumber, amount, currency, dueDate` (YYYY-MM-DD). 201 / 400 / 409 |
| DELETE | `/api/invoices/{id}` | delete |
| POST | `/api/test/reset` | delete all data, ids restart at 1 |

## 5. Business rules
- Required: customer, invoice number, amount, currency (SEK/EUR/DKK/NOK), due date → missing fields give visible validation errors (400), nothing is created.
- Amount ≤ 0 (or not a number) → validation error "Amount must be greater than 0." (never REJECTED).
- Duplicate invoice number (case-insensitive) → 409, "Invoice number X already exists."
- Amount accepts `10000`, `10,000`, `10 000`, `10000.50`.
- Lifecycle by invoice age: 0–1 s `CREATED`, 1–3 s `PROCESSING`, from 3 s `APPROVED`. Same every time.
- Due dates in the past are accepted (not a rule in this demo).

## 6. V1 vs V2
| | V1 | V2 |
|---|---|---|
| Layout | Header, single column, stacked panels | Left sidebar navigation, content area |
| Form | One vertical form; Customer, Invoice number, Amount, Currency, Due date | Sections "Customer Details" / "Invoice Details"; 2-column grid; Client, Invoice #, Amount, Currency, Payment due by |
| Primary button | "Create Invoice", bottom right of form | "Submit Invoice", top right of page |
| List | Table | Cards on a separate "All Invoices" page (shown after a successful submit) |
| Details | Panel below the list | Slide-in drawer on the right |

Switch with the **UI Version V1/V2** control in the yellow "Demo controls" bar (choice is kept on refresh).

## Evidence of which UI was used
- The demo bar shows `Active UI: V1/V2` (also `data-ui` on `<body>`, `data-testid="active-ui"`).
- Each invoice has `createdVia`: `V1` or `V2` if created through the UI (UI sends header `X-Client-UI`), `API` otherwise.
- Not tamper-proof: a script can send the header itself. Fine for a demo.

## 7. Reset test data
Click **Reset test data** in the Demo controls bar, or `curl -X POST <url>/api/test/reset`.

## 8. Render
`render.yaml` defines a free Node web service (`npm install` / `npm start`, health check `/api/health`).
Create it via Render → New → Blueprint (or Web Service) pointing at this repo (app is at the repo root).
