# Meteora Trending Pairs - Documentation Index

## Overview
The Meteora Trending Pairs Application is a comprehensive real-time analytics and monitoring platform for Meteora DLMM liquidity pools on Solana. This index guides you to the appropriate documentation.

---

## Documentation Files

### 1. **PROJECT_DOCUMENTATION.md** (28 KB)
**The complete, detailed reference guide**

Contains:
- Full application architecture and design
- All API endpoints with parameters and responses
- Complete technology stack details
- Database models with SQL schemas
- Component descriptions and state management
- Special features (Telegram, Wallet Manager, Monitoring Services)
- Performance optimizations and scalability strategies
- Data processing pipelines
- Deployment and setup instructions

**When to use**: When you need comprehensive understanding of any aspect of the application.

---

### 2. **QUICK_REFERENCE.md** (11 KB)
**The handy cheat sheet for developers**

Contains:
- What the app does at a glance
- Key components and their purposes
- API endpoints summary
- External data sources
- Database models overview
- Running the application
- Feature explanations
- Troubleshooting tips
- Architecture diagram

**When to use**: When you need quick answers, starting development, or debugging.

---

### 3. **README.md** (11 KB)
**The original project overview**

Contains:
- High-level project description
- Features overview
- Use cases
- Technology stack
- Installation instructions
- Acknowledgments

**When to use**: Initial project orientation, sharing with others.

---

### 4. **TELEGRAM_MONITORING_SETUP.md** (9 KB)
**Step-by-step Telegram bot configuration guide**

Contains:
- Creating Telegram bot with BotFather
- Supabase database setup
- Backend environment configuration
- Frontend setup for Telegram integration
- Testing and troubleshooting

**When to use**: Setting up Telegram bot integration for the first time.

---

## Quick Navigation by Task

### Understanding the Application
1. Start with **README.md** for overview
2. Read **QUICK_REFERENCE.md** section "What Does This Application Do?"
3. Review **PROJECT_DOCUMENTATION.md** section 1 for detailed features

### Setting Up Development Environment
1. Check **QUICK_REFERENCE.md** section "Running the Application"
2. Follow **PROJECT_DOCUMENTATION.md** section 13 "Deployment & Setup"
3. For Telegram features: **TELEGRAM_MONITORING_SETUP.md**

### Adding New Features
1. Check **QUICK_REFERENCE.md** section "Next Steps for Development"
2. Review relevant component in **PROJECT_DOCUMENTATION.md** section 5
3. Find exact file location in "Important Files & Locations"

### Debugging Issues
1. First try **QUICK_REFERENCE.md** "Troubleshooting Quick Tips"
2. Check logs and compare with **PROJECT_DOCUMENTATION.md** section 12 "Error Handling"
3. Review API endpoints in **PROJECT_DOCUMENTATION.md** section 4

### Understanding the Architecture
1. View architecture diagram in **QUICK_REFERENCE.md**
2. Read detailed architecture in **PROJECT_DOCUMENTATION.md** section 2
3. Review technology stack in **PROJECT_DOCUMENTATION.md** section 3

### Working with Specific Components

**Frontend Components**:
- **QUICK_REFERENCE.md** "Key Components At a Glance"
- **PROJECT_DOCUMENTATION.md** section 5 "Frontend Pages & Components"

**Backend Services**:
- **QUICK_REFERENCE.md** "Backend (Flask)" table
- **PROJECT_DOCUMENTATION.md** section 6 "Special Features"

**Database**:
- **QUICK_REFERENCE.md** "Database Models"
- **PROJECT_DOCUMENTATION.md** section 7 "Database Models"

**API Integration**:
- **QUICK_REFERENCE.md** "API Endpoints Quick List"
- **PROJECT_DOCUMENTATION.md** section 4 "API Endpoints & Data Flow"

### Performance Optimization
- **QUICK_REFERENCE.md** "Performance Optimizations"
- **PROJECT_DOCUMENTATION.md** section 9 "Performance & Scalability"

### Telegram Integration
- **TELEGRAM_MONITORING_SETUP.md** (step-by-step)
- **PROJECT_DOCUMENTATION.md** section 6 "Special Features" → "Telegram Bot Integration"
- **QUICK_REFERENCE.md** section 3 "Degen Mode"

---

## File Organization

### Core Documentation Files
```
/home/ayman/meteora-trending-pairs/
├── PROJECT_DOCUMENTATION.md        ← Comprehensive reference (start here for details)
├── QUICK_REFERENCE.md              ← Quick lookup guide (start here for quick answers)
├── README.md                        ← Project overview (for newcomers)
├── TELEGRAM_MONITORING_SETUP.md     ← Telegram bot setup guide
└── DOCUMENTATION_INDEX.md           ← This file
```

### Project Files
```
frontend/
├── src/pages/                       ← Page components
├── src/components/                  ← Reusable components
├── src/services/                    ← API service calls
└── src/utils/                       ← Helper functions

backend/
├── app.py                          ← Main Flask application
├── models.py                       ← Database models
├── pool_cache.py                   ← Data caching
├── monitoring_service.py           ← Capital rotation monitoring
├── telegram_bot.py                 ← Telegram integration
└── services/monitoring/            ← Monitoring services

services/dlmm-service/
├── index.js                        ← Express server
└── dlmmController.js               ← DLMM calculations
```

---

## Quick Links by Section

### Section 1: Application Purpose & Features
- **File**: PROJECT_DOCUMENTATION.md
- **For**: Understanding what the app does

### Section 2: Project Structure
- **File**: PROJECT_DOCUMENTATION.md
- **Alternative**: QUICK_REFERENCE.md "Key Components At a Glance"
- **For**: Understanding file organization

### Section 3: Technology Stack
- **File**: PROJECT_DOCUMENTATION.md
- **Alternative**: README.md
- **For**: Understanding dependencies

### Section 4: API Endpoints
- **File**: PROJECT_DOCUMENTATION.md
- **Quick**: QUICK_REFERENCE.md "API Endpoints Quick List"
- **For**: API integration work

### Section 5: Frontend Pages & Components
- **File**: PROJECT_DOCUMENTATION.md
- **Quick**: QUICK_REFERENCE.md "Frontend" table
- **For**: Frontend development

### Section 6: Special Features
- **File**: PROJECT_DOCUMENTATION.md
- **Setup**: TELEGRAM_MONITORING_SETUP.md
- **For**: Telegram, monitoring, degen mode

### Section 7: Database Models
- **File**: PROJECT_DOCUMENTATION.md
- **Quick**: QUICK_REFERENCE.md "Database Models"
- **For**: Database schema and relationships

### Section 8-13: Advanced Topics
- **File**: PROJECT_DOCUMENTATION.md
- **Topics**: Integrations, Performance, Configuration, Data Pipeline, Error Handling, Deployment
- **For**: Advanced development and optimization

---

## Information Density by Document

### README.md
- **Length**: 11 KB
- **Scope**: High-level overview
- **Depth**: Introductory
- **Best for**: New developers, stakeholders

### QUICK_REFERENCE.md
- **Length**: 11 KB
- **Scope**: Specific, actionable
- **Depth**: Medium
- **Best for**: Active developers, quick lookups

### PROJECT_DOCUMENTATION.md
- **Length**: 28 KB
- **Scope**: Comprehensive
- **Depth**: Detailed
- **Best for**: Deep understanding, reference

### TELEGRAM_MONITORING_SETUP.md
- **Length**: 9 KB
- **Scope**: Specific feature
- **Depth**: Step-by-step
- **Best for**: Initial setup

---

## Documentation Version Info

- **Created**: November 11, 2025
- **Project Branch**: dev
- **Latest Commits**: 
  - dfde4c9: fix: Correct Meteora API data access in degen monitoring
  - 6507642: fix: Correct pool_cache import in degen monitoring service
  - 7548f7c: feat: Add Degen Mode for high-fee pool monitoring with Telegram notifications

---

## How to Use This Documentation

1. **First Time?** 
   - Read README.md for overview
   - Check QUICK_REFERENCE.md for component overview
   - Set up following "Running the Application" section

2. **Need to Add Features?**
   - Find component in QUICK_REFERENCE.md
   - Jump to detailed section in PROJECT_DOCUMENTATION.md
   - Reference exact file locations

3. **Debugging?**
   - Check QUICK_REFERENCE.md troubleshooting
   - Review PROJECT_DOCUMENTATION.md error handling
   - Check relevant service logs

4. **Setting Up Telegram?**
   - Follow TELEGRAM_MONITORING_SETUP.md
   - Reference Telegram sections in PROJECT_DOCUMENTATION.md

5. **Want Complete Picture?**
   - Read PROJECT_DOCUMENTATION.md sections 1-4 for architecture
   - Read sections 5-7 for implementation details
   - Read sections 8-13 for advanced topics

---

## Key Concepts to Understand

### Essential Understanding
- **DLMM Pools**: Meteora's Dynamic Liquidity Market Maker protocol
- **Fee Rate**: 30-minute fees divided by total liquidity (percentage)
- **APR**: Annual Percentage Rate calculated from daily fees
- **TVL**: Total Value Locked in USD across all token pairs

### Important Features
- **Capital Rotation**: Monitor pools for fee opportunities with Telegram alerts
- **Degen Mode**: High-frequency monitoring of all pools for high fee rates
- **Pool Cache**: 5-minute singleton cache preventing redundant API calls
- **Monitoring Service**: Background scheduler for automated opportunity detection

### Technical Pillars
- **Frontend**: React with Material-UI, real-time filtering and sorting
- **Backend**: Flask with SQLAlchemy ORM, APScheduler for background jobs
- **Database**: PostgreSQL (via Supabase) for user data and configurations
- **Microservice**: Node.js/Express for DLMM liquidity calculations
- **External APIs**: Meteora, DexScreener, Jupiter, RugCheck, Helius, BubbleMaps

---

## Support & Help

### Documentation Issues?
- Check DOCUMENTATION_INDEX.md (this file)
- Review file organization section
- Use "Quick Navigation by Task" above

### Feature Questions?
- Check PROJECT_DOCUMENTATION.md section 6 "Special Features"
- Review QUICK_REFERENCE.md feature explanations

### Setup Problems?
- Read TELEGRAM_MONITORING_SETUP.md for bot setup
- Check QUICK_REFERENCE.md "Troubleshooting Quick Tips"
- Review PROJECT_DOCUMENTATION.md section 13 "Deployment & Setup"

### Code-Specific Questions?
- Check "Important Files & Locations" in QUICK_REFERENCE.md
- Reference component descriptions in PROJECT_DOCUMENTATION.md
- Review relevant code file comments

---

**Last Updated**: November 11, 2025
**Documentation Quality**: Medium thoroughness (comprehensive)
**File Links**: All references point to files in `/home/ayman/meteora-trending-pairs/`
