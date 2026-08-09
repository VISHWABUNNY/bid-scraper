# TenderIQ — Government Procurement Intelligence Platform

> A production-grade Tender Intelligence Engine designed to automate bid discovery, eliminate non-relevant civil/construction noise, and surface high-probability IT & Software government procurement leads (≤ ₹20 Lakhs with MSME/Startup EMD exemptions).

---

## 📋 Table of Contents
1. [User Manual & Procurement Team Guide](#-user-manual--procurement-team-guide)
2. [How the Tender List Updates (Sync Engine)](#-how-the-tender-list-updates-sync-engine)
3. [Automated Shortlisting & Suitability Scoring Engine](#-automated-shortlisting--suitability-scoring-engine)
4. [Architecture Overview](#architecture-overview)
5. [Tech Stack](#tech-stack)
6. [Quick Start (Local Development)](#quick-start-development)
7. [REST API Reference](#rest-api-reference)
8. [Adding a New Portal Scraper](#adding-a-new-portal-scraper)

---

## 📖 User Manual & Procurement Team Guide

### 🚀 Daily Procurement Workflow

```
 ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
 │ 1. Morning Check │───>│ 2. Find High-    │───>│ 3. Deep Dive     │───>│ 4. Track & Submit│
 │    Dashboard     │    │    Rating Bids   │    │    & RFP Docs    │    │    on Portal     │
 └──────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

#### Step 1: Morning Pipeline Review (`/dashboard`)
- **Total Pipeline Value**: View cumulative ₹ value of active opportunities.
- **Active Tenders & Scraped Today**: See how many new opportunities were added.
- **Closing Soon (within 3 days)**: Pay special attention to upcoming deadlines so your team never misses submission cutoff times.
- **Portal Health Status**: Confirm live connection status for GeM and state portals.

#### Step 2: Lead Discovery & Rating (`/tenders`)
- **Suitability Rating (★ Out of 10.0)**: Automatically calculated for every bid. Focus first on bids rated **8.0+**.
- **Shortlist Criteria Badges**:
  - `IT / Software`: Verified software, web portal, MIS, mobile app, or AI project.
  - `MSME EMD Exempt`: Earnest Money Deposit waived for registered MSMEs.
  - `Startup Relaxed`: Prior turnover/experience criteria relaxed for DPIIT startups.
  - `Defence Bids`: Automatically highlights DRDO, Naval, or Military IT requirements.
- **Custom Filters**: Filter by state, maximum budget (default: ≤ ₹20 Lakhs), or keywords (e.g. `dashboard`, `AI`, `cloud`, `).

#### Step 3: Deep Dive & RFP Inspection (`/tenders/:id`)
- **Organization & Department**: See exact government buying entity.
- **Financial Details**: Verify estimated budget, exact EMD amount, and exemptions.
- **RFP Documents**: Download attached PDF specifications.
- **View on Portal**: Click the button to launch the official portal (e.g. GeM) and submit the bid.

#### Step 4: Topbar Notification Bell
- When a new tender matching your company's saved filter rules is scraped, a badge counter appears on the topbar **Bell Icon**.
- Click it to preview unread alerts and open tenders directly.

---

## 🔄 How the Tender List Updates (Sync Engine)

The tender list updates **automatically and continuously** through three synchronized layers:

### 1. ⏰ Automated Background Cron Scheduler (Hands-Free)
- The background **Scheduler process** (`npm run scheduler`) runs 24/7.
- **GeM Portal**: Automatically scraped every **15 minutes**.
- **CPPP Portal**: Automatically scraped every **30 minutes**.
- **Process**: Pushes scrape jobs to Redis BullMQ. The Scraper Worker parses newly published portal tenders, evaluates shortlist rules, and inserts them into PostgreSQL.

### 2. ⚡ On-Demand Manual Sync ("Run Scraper" Button)
- Need fresh leads right now before a bid strategy meeting?
- Go to **Scraper Status** page (`/scraper`) → Click **Run Scraper** → Select source (e.g. `GEM`) → Click **Start Scraping**.
- The backend worker fetches the latest portal pages in 15–30 seconds. Switch back to **Shortlisted Bids** (`/tenders`) to see the latest leads at the top of the list.

### 3. 🔄 Smart Deduplication & In-Place Updates
- **Unique Reference Number Constraint**: TenderIQ tracks unique tender numbers (e.g. `GEM/2026/B/5981240`).
- **New Tender**: Assigned a suitability rating (0.0 to 10.0) and generates an in-app notification.
- **Existing Tender**: Updated in-place (closing date, document links, value) without duplicates.

---

## 🎯 Automated Shortlisting & Suitability Scoring Engine

TenderIQ applies an automated scoring algorithm out of **10.0 Stars**:

| Criteria | Points | Description |
|----------|--------|-------------|
| **IT/Software Category** | +3.5 | Keyword match (`software`, `web`, `AI`, `MIS`, `portal`, `mobile`, `cloud`) |
| **High Keyword Density** | +1.0 | 3 or more matching IT keywords |
| **Budget Eligibility** | +2.0 | Contract value ≤ ₹20 Lakhs (or undisclosed) |
| **EMD Exemption** | +1.5 | Earnest Money Deposit waived for MSME/Startup |
| **MSE Relaxation** | +1.0 | Micro & Small Enterprise relaxation offered |
| **Startup Exemption** | +1.0 | DPIIT Startup relaxation offered |

> **Threshold**: Tenders scoring **≥ 8.0/10.0** are automatically highlighted as **Shortlisted Bids**. Non-IT categories (civil, construction, plumbing, sanitation) are automatically assigned **0.0/10.0** and filtered out.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   React Dashboard (Vite + MUI)          │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│              Express.js API Server (TypeScript)         │
│  Auth · Tenders · Scraper · Notifications · Documents   │
└────────┬──────────────────────────────┬─────────────────┘
         │                              │
┌────────▼────────┐          ┌──────────▼──────────┐
│   PostgreSQL    │          │        Redis         │
│  (Prisma ORM)   │          │    (BullMQ Queues)   │
└─────────────────┘          └──────────┬───────────┘
                                        │
                             ┌──────────▼───────────┐
                             │   BullMQ Workers      │
                             │  Scraper · Download   │
                             │  Notification · OCR   │
                             └──────────┬────────────┘
                                        │
                             ┌──────────▼───────────┐
                             │  Playwright Scrapers  │
                             │  GEM · CPPP · AP · TS │
                             └──────────────────────┘
```

---

## Tech Stack

| Layer        | Technology                          |
|-------------|-------------------------------------|
| Frontend     | React 18 + Vite + Material UI       |
| Backend      | Node.js + Express + TypeScript       |
| Database     | PostgreSQL 16 + Prisma ORM           |
| Queue        | Redis + BullMQ                       |
| Scraping     | Playwright + Cheerio                 |
| Auth         | JWT + Refresh Token Rotation         |
| Logging      | Winston + Daily Rotate               |
| Validation   | Zod                                  |
| Deployment   | Docker + Docker Compose + Nginx      |

---

## Quick Start (Development)

### Automated Setup Script
```bash
./setup.sh
```
The script handles environment configuration, database setup/seeding, and starts all services in the background.

### Manual Setup
```bash
# 1. Install Dependencies
npm run install:all

# 2. Database Migration & Seed
cd backend
npx prisma generate --schema=../database/prisma/schema.prisma
npx prisma migrate dev --schema=../database/prisma/schema.prisma
npm run db:seed

# 3. Start Services (in separate terminals)
cd backend && npm run dev        # API Server (Port 5000)
cd backend && npm run worker     # Scraper & Notification Workers
cd backend && npm run scheduler  # Automated Cron Scheduler
cd frontend && npm run dev       # React Dashboard (Port 5173)
```

| Service  | URL                        |
|---------|---------------------------|
| Dashboard | http://localhost:5173     |
| API       | http://localhost:5000     |
| Health    | http://localhost:5000/health |

**Default System Credentials:** `admin@tenderplatform.com` / `Admin@123`

---

## REST API Reference

### Tenders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenders` | List tenders with filters & pagination |
| GET | `/api/v1/tenders/:id` | Tender details with documents |
| GET | `/api/v1/tenders/search?q=software` | Full-text search |
| GET | `/api/v1/tenders/dashboard` | Aggregated dashboard stats |
| GET | `/api/v1/tenders/saved` | List saved tenders |
| POST | `/api/v1/tenders/saved` | Save a tender |
| DELETE | `/api/v1/tenders/saved/:id` | Unsave tender |

### Scraper Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/scraper/run` | Trigger on-demand scrape job |
| GET | `/api/v1/scraper/status` | Queue status & portal health |
| GET | `/api/v1/scraper/logs` | Execution logs |
| POST | `/api/v1/scraper/retry/:jobId` | Retry failed scrape job |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications` | List user notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark single notification as read |
| PATCH | `/api/v1/notifications/read-all` | Mark all notifications as read |
| GET | `/api/v1/notifications/settings` | Get filter preferences |
| POST | `/api/v1/notifications/settings` | Save filter preferences |

---

## Adding a New Portal Scraper

1. Create `backend/src/scrapers/<portal>/` directory.
2. Create `config.ts` with `ScraperConfig`.
3. Create `parser.ts` using Cheerio HTML parsing.
4. Implement `BaseScraper` class in `index.ts`.
5. Register in `scrapers/common/scraper-registry.ts`.
6. Add queue entry in `queues/scraper.queue.ts` and schedule in `scheduler/index.ts`.

---

## License
MIT
