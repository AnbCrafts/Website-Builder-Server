# Nirman.AI: Backend Dependencies Registry

This document catalogs the backend core production dependencies utilized to orchestrate the distributed Multi-AI Agent Generation Engine using Node.js (ES Modules).

## Production Dependencies (`dependencies`)

| Package Name | Architecture Role | Description & Purpose |
| :--- | :--- | :--- |
| `express` | **Core HTTP Router** | High-performance, lightweight web framework used to construct the API endpoints and manage the middleware execution pipeline. |
| `@google/genai` | **Agent 1: UI Developer** | The official, production-ready Google SDK used to prompt `gemini-2.5-flash-lite` for ultra-fast, structural HTML and layout responsive grid streaming. |
| `cohere-ai` | **Agent 4: Design Auditor** | SDK interface linking the platform to the vision evaluation tier to execute automated UX accessibility reviews, contrast checks, and layout sanity scores. |
| `cors` | **Cross-Origin Security** | Configures network access boundaries, safely allowing the frontend React dashboard application to communicate with backend execution endpoints. |
| `dotenv` | **Configuration Secrets** | Decouples infrastructure environmental setups (`.env`), injecting upstream secret tokens (Gemini, Groq, Cohere) into running process instances securely. |
| `helmet` | **HTTP Security Hardening** | Automatically injects key secure headers (e.g., XSS protections, Content-Security-Policies) to insulate the server core against unauthorized injection attempts. |
| `express-rate-limit` | **API Abuse Prevention** | Protects downstream free tier LLM endpoints against brute-force degradation loops by tracking and constraining client request velocity. |
| `zod` | **Runtime Schema Integrity** | Strict parsing library used to validate arbitrary multi-stage agent payloads and check input prompt integrity at runtime boundaries. |