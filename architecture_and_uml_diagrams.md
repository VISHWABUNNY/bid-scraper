# TenderIQ — Architecture & System Design

Simple, direct procurement scraper engine. Searches GeM by keyword, evaluates bids, stores results.

---

## 1. System Architecture

```mermaid
flowchart TB
    subgraph Frontend ["Frontend — http://localhost:5173"]
        UI["React App\nApp.tsx"]
    end

    subgraph Backend ["Backend — http://localhost:5000"]
        API["Express API\nindex.ts"]
        KW["Keywords Loader\nkeywords.ts"]
        SC["GeM Scraper\nscraper.ts"]
        EV["Shortlist Evaluator\nevaluator.ts"]
        DB["DB Layer\ndb.ts"]
    end

    subgraph DB_Layer ["PostgreSQL"]
        BIDS[("bids table")]
    end

    subgraph External ["External"]
        GEM["GeM Portal\nbidplus.gem.gov.in"]
        MD["Search keywords.md"]
    end

    UI -->|POST /run| API
    UI -->|GET /shortlisted| API
    UI -->|DELETE /clear| API

    API --> KW
    KW --> MD
    API --> SC
    SC --> GEM
    SC --> EV
    EV --> DB
    DB --> BIDS
    API --> DB
```

---

## 2. Request Flow — Run Scrape

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Keywords
    participant Scraper
    participant Evaluator
    participant Database
    participant GeM

    User->>Frontend: Click "Run Scrape"
    Frontend->>API: POST /run
    API->>Keywords: loadKeywords()
    Keywords-->>API: string[] from Search keywords.md

    API->>Scraper: scrapeGemByKeywords(keywords)
    loop For each keyword
        Scraper->>GeM: Open page, fill search, press Enter
        GeM-->>Scraper: Bid cards HTML
        Scraper->>Scraper: Extract bid data, deduplicate
    end
    Scraper-->>API: GemBid[]

    loop For each bid
        API->>Evaluator: evaluate(bid)
        Evaluator-->>API: { shortlisted, reason }
        API->>Database: saveBid(bid + shortlisted flag)
    end

    API-->>Frontend: { total, shortlisted count }
    Frontend->>API: GET /shortlisted
    API->>Database: getShortlisted()
    Database-->>Frontend: Shortlisted bids[]
    Frontend-->>User: Show bids with GeM links
```

---

## 3. Shortlist Evaluation Logic

```mermaid
flowchart TD
    A[Incoming Bid] --> B{Contains IT keyword?}
    B -- No --> REJECT1[❌ Reject — Not IT-related]
    B -- Yes --> C{Contains reject keyword?\nconstruction / civil / electrical}
    C -- Yes --> REJECT2[❌ Reject — Non-IT domain]
    C -- No --> D{Value ≤ ₹20 Lakh?}
    D -- No --> REJECT3[❌ Reject — Exceeds budget]
    D -- Yes or unknown --> E{MSME or Startup eligible?}
    E -- No --> REJECT4[❌ Reject — No exemption]
    E -- Yes --> PASS[✅ Shortlisted]
```

---

## 4. File Structure

```
scraper/
├── setup.sh                    # Start everything
├── Search keywords.md          # (inside backend/) Your keyword list
│
├── backend/
│   ├── .env                    # 4 lines: NODE_ENV, PORT, FRONTEND_URL, DATABASE_URL
│   ├── package.json
│   └── src/
│       ├── index.ts            # Express server — 3 routes
│       ├── scraper.ts          # Playwright → GeM search
│       ├── evaluator.ts        # Shortlist criteria checker
│       ├── db.ts               # Save / get / clear bids
│       └── keywords.ts         # Reads Search keywords.md
│
├── frontend/
│   └── src/
│       ├── App.tsx             # Single page UI
│       ├── index.css           # Dark UI styles
│       └── main.tsx            # Entry point
│
└── database/
    └── prisma/
        └── schema.prisma       # Single "bids" table
```

---

## 5. Database Schema

```mermaid
erDiagram
    BIDS {
        uuid    id          PK
        string  bidId       UNIQUE
        string  title
        string  organisation
        string  gemUrl
        float   value       "nullable"
        string  closingDate "nullable"
        bool    isMsme
        bool    isStartup
        string  keyword
        string  docText     "nullable"
        bool    shortlisted
        datetime createdAt
    }
```

---

## 6. API Endpoints

| Method | Route | What it does |
|--------|-------|--------------|
| `POST` | `/run` | Search GeM with all keywords, evaluate, save results |
| `GET` | `/shortlisted` | Return all bids that passed shortlist criteria |
| `DELETE` | `/clear` | Wipe all saved bids from the database |

---

## 7. Shortlist Criteria

| Criteria | Rule |
|----------|------|
| IT-related | Title must contain: software, web, mobile, app, portal, dashboard, AI, MIS, CRM, cloud, SaaS, etc. |
| Value cap | ≤ ₹20 Lakh (if value is known) |
| MSME / Startup | Must have MSME or Startup exemption mentioned |
| Reject keywords | Rejects if title contains: construction, civil, electrical, supply of, furniture, printing, catering, manpower, housekeeping |
