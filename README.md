# Nirman.AI - Generative Website Builder (Backend Server)

Welcome to the backend orchestration engine of **Nirman.AI**, an industrial-grade, multi-agent AI website generator and real-time design playground. The server compiles responsive HTML pages using Tailwind CSS and GSAP animations, tracks versions, executes accessibility design audits, manages isolated team workspaces with role-based collaboration, and facilitates Stripe subscription checkouts.

---

## 🏗️ Architecture & Naming Conventions

This project follows a strict separation of concerns, separating data models, request validators, security gates, and route handlers.

### Custom Filename Format
To maintain clear contextual bindings, files are structured under a strict `Schema.Folder.js` naming pattern:
* **Models/Schemas**: Placed under `src/Schema/` (e.g., `User.Schema.js`)
* **Request Validators**: Placed under `src/Validations/` (e.g., `User.Validation.js`)
* **Middlewares**: Placed under `src/Middlewares/` (e.g., `User.Middleware.js`)
* **Controllers**: Placed under `src/Controller/` (e.g., `User.Controller.js`)
* **Routes**: Placed under `src/Route/` (e.g., `User.Route.js`)

---

## 📂 Project Directory Structure

```text
website-builder-server/
├── src/
│   ├── Configs/
│   │   └── Database.Config.js         # Mongoose MongoDB connection pooling
│   ├── Constants/                     # Shared config presets
│   ├── Controller/
│   │   ├── Billing.Controller.js      # Stripe checkout, portal, and webhook handlers
│   │   ├── Project.Controller.js      # AI compiler, audits, versions, rollbacks
│   │   ├── User.Controller.js         # Cookie-based auth, registration, switching workspaces
│   │   └── Workspace.Controller.js   # Workspaces creation, collaborators onboarding
│   ├── Middlewares/
│   │   ├── Common.Middleware.js       # Dynamic Zod field validation, global rate limiters
│   │   ├── Project.Middleware.js      # Project authorization permissions (RBAC)
│   │   ├── Subscription.Middleware.js # Plan limits gating (free vs premium limits)
│   │   ├── User.Middleware.js         # HTTP-only cookie JWT verification
│   │   └── Workspace.Middleware.js    # Workspace collaborator role gating & billing limits
│   ├── Route/
│   │   ├── Billing.Route.js
│   │   ├── Project.Route.js
│   │   ├── User.Route.js
│   │   └── Workspace.Route.js
│   ├── Schema/
│   │   ├── ActivityLog.Schema.js      # Security Audit Trails
│   │   ├── Project.Schema.js          # Project details, code versions, design audits
│   │   ├── Subscription.Schema.js     # stripe ids, plan tiers, period limits
│   │   ├── User.Schema.js             # Credentials, active workspaces
│   │   └── Workspace.Schema.js        # Slugs, collaborators roll, active projects
│   ├── Utils/
│   │   ├── ApiError.Util.js           # Standardized API response error model
│   │   ├── AsyncHandler.Util.js       # Promise catch wrapper for clean controllers
│   │   ├── Cookie.Util.js             # Environment-aware cookie settings generator
│   │   ├── SuccessResponse.Util.js    # Standardized API response layout
│   │   └── Token.Util.js              # Access / Refresh JWT cycle builders
│   └── Validations/
│       ├── Billing.Validation.js
│       ├── Project.Validation.js
│       ├── User.Validation.js
│       └── Workspace.Validation.js
├── .env                               # Environment secrets (Port, DB URI, Stripe, Gemini)
├── index.js                           # Express entry point and middleware assembly
├── package.json
└── README.md
```

---

## 🔒 Security & Authentication

### 1. HTTP-Only Cookie Session Architecture
Rather than storing tokens in vulnerable client-side storage headers (e.g., `localStorage`), Nirman.AI implements double-signed token rotations via browser cookies:
* **Access Tokens**: Short-lived (15 minutes) for API request validation.
* **Refresh Tokens**: Long-lived (7 days) for silent session updates.
* **Cookie Flags**: Secured with `httpOnly: true`, `secure: true` (production), and `sameSite: 'None'` to prevent Cross-Site Scripting (XSS) and cross-origin resource leaks.

### 2. Role-Based Access Control (RBAC)
Granular access control middlewares intercept requests to ensure users only access resources they are authorized for:
* **Workspace Access Gating** (`verifyWorkspaceAccess(['admin', 'editor', 'viewer'])`): Gated based on owner matches or collaborator listings.
* **Project Access Gating** (`verifyProjectAccess(['admin', 'editor'])`): Gated to match permissions required to edit, delete, or audit workspace projects.

### 3. Rate-Limiting Controls
Protects backend computational pipelines against Denial of Service (DoS) and API abuse:
* **Global Rate Limiter**: 100 requests per 15-minute window for standard auth endpoints.
* **AI Generation Rate Limiter**: Maximum 10 generations per hour to manage token cost limits.

---

## 💳 Stripe Subscriptions & Billing Sync

The system integrates directly with **Stripe** to govern feature access based on subscription tiers (Free, Basic, Premium, Agency):
* **Checkout Link Generator**: Generates redirection URLs to Stripe's secure checkout page.
* **Stripe Customer Portal**: Provides instant access for users to update credit cards, view invoices, or cancel plans without manual support.
* **Stripe Webhook Efficacy**: Configured *prior* to Express JSON parsers to ingest events (`invoice.paid`, `customer.subscription.deleted`) as a **raw body buffer**. This allows secure validation of Stripe signature signatures.

---

## 🤖 Advanced AI Capabilities

1. **Multi-Agent Gemini Orchestrator**:
   * Takes a single natural language description.
   * Prompts specialized agents: *Layout Architect* (Tailwind grid construction), *Copywriter* (contextual messaging), and *Illustrator* (Unsplash keyword-matching links).
   * Generates a fully working single-page application and registers version history.
2. **Design Auditor**:
   * Passes compiled code blocks to Gemini to review design standards.
   * Compiles and returns a score (0-100) alongside structured accessibility and SEO recommendations.

---

## 🛠️ Main Packages & Dependencies

### Dependencies
* `express` & `cors`: Web frame router and cross-origin resource sharing policies.
* `mongoose`: High-performance MongoDB object data modeling.
* `zod`: Type-safe schema validation.
* `jsonwebtoken`: Secure JWT creation and payload validation.
* `bcryptjs`: Secure password hashing.
* `stripe`: Stripe billing session and portal sdk.
* `@google/genai`: Google Gemini developer API.
* `cookie-parser`: Parser for request cookies.
* `express-rate-limit`: Request throttling middleware.

### Dev Dependencies
* `nodemon`: Hot-reloading development server runner.

---

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables** (`.env`):
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://127.0.0.1:27017/nirman
   GEMINI_API_KEY=your_gemini_api_key
   JWT_SECRET=your_jwt_secret
   ACCESS_TOKEN_SECRET=your_access_secret
   REFRESH_TOKEN_SECRET=your_refresh_secret
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_webhook_signing_secret
   STRIPE_BASIC_PRICE_ID=price_xxxxxx
   STRIPE_PREMIUM_PRICE_ID=price_yyyyyy
   CLIENT_URL=http://localhost:5173
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```
