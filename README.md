# AutoFeast AI – Autonomous Food Ordering & Health Recommendation System

> **StartupFair Hackathon Project**  
> **Repository ID:** `sona-final-year-mini-it-aids-d-heymathi-t-763`  
> **Participant:** Solo Participant 63 — Final Year Mini Project (IT / AI&DS Department)  
> **Developer:** D. Heymathi  

---

## 📌 Project Overview

**AutoFeast AI** is an intelligent, voice-first, autonomous food ordering and dietary recommendation platform built to empower elderly individuals, caregivers, and health-conscious users. Combining client-side voice processing, conversational AI, and medical safety guardrails, AutoFeast AI enables hands-free discovery, health-aware meal planning, and automated scheduling across local restaurants.

---

## ✨ Key Features

1. **Dual Voice Recognition Engine**:
   - **Online**: High-precision browser Web Speech API for immediate natural-language interaction in **English**, **Tamil**, and **Hindi**.
   - **Offline**: Zero-cloud client-side transcription powered by **Whisper Tiny ONNX Runtime (WASM)** with real-time Voice Activity Detection (VAD) and silence endpointing.

2. **Health-Based Dietary Recommendation System**:
   - Analyzes user medical profiles (Heart Health, Diabetes, High Blood Pressure, Cholesterol, Digestive Comfort) and age context (60+ seniors).
   - Generates tailored dish recommendations with transparent *"Why this fits"* medical rationales and dietary badges (*Steamed*, *Low-Oil*, *Diabetic-Friendly*, *High-Fiber*).
   - Enforces strict safety contraindications and maintains a mandatory medical disclaimer notice at all times.

3. **Gemini 2.5 Flash & Deterministic Fallback Pipeline**:
   - Connects to Google's **Gemini 2.5 Flash** for smart intent extraction and semantic catalog search.
   - Guarded by strict timeouts (3500ms client `AbortController` / 4500ms server `Promise.race`), request deduplication, and in-memory TTL caching.
   - Instant deterministic catalog fallback ensures zero indefinite hangs or blank states, even when offline or unconfigured.

4. **Nominee & Family Guardian Management**:
   - Nominee budget controls with daily spending limits.
   - Automated email alerts via Nodemailer for order confirmations and limit renewals.
   - Security PIN verification for high-value orders and schedule changes.

5. **Multi-Platform Price Comparison**:
   - Compares live pricing across Swiggy, Zomato, Magicpin, and Direct Restaurant platforms to secure optimal rates.

6. **Automated Order Scheduler**:
   - Recurring meal orders (Breakfast, Lunch, Dinner) automated through calendar-based scheduling.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide React, Motion (Framer Motion), Canvas Confetti.
- **Speech & Local AI**: Web Speech API (STT & TTS), Transformers.js (Whisper Tiny ONNX Runtime WASM), Fuse.js fuzzy matcher.
- **Backend**: Node.js, Express, MongoDB with Mongoose, Google Gen AI SDK (`@google/genai`).
- **Communication & Security**: Nodemailer (Gmail SMTP alerts), Bcryptjs (PIN/Password hashing), Dotenv.
- **Testing & Quality Assurance**: Vitest, React Testing Library, JSDOM.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **npm** or **pnpm**

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/Heymathi/AutoFeast-Autonomous-Food-Ordering-System.git
   cd AutoFeast
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and provide your credentials (keep server-side only; never expose credentials):
   ```bash
   cp .env.example .env
   ```
   Key variables:
   - `GEMINI_API_KEY`: Google Gen AI API key for Gemini 2.5 Flash
   - `GMAIL_USER` & `GMAIL_APP_PASSWORD`: SMTP credentials for nominee notifications
   - `JWT_SECRET`: Secret key for session security

4. Start the full application (Frontend + Express Backend):
   ```bash
   npm run dev
   ```

---

## 🧪 Testing & Verification

Run the comprehensive test suites with Vitest:

```bash
# Run Health Recommendation Pipeline verification suite
npx vitest run src/tests/healthRecommendationPipeline.test.tsx

# Run Recommendation Features Mapping suite
npx vitest run src/tests/recommendationFeaturesMapping.test.tsx

# Run Voice Intent and Speech Reliability tests
npx vitest run src/services/__tests__/voiceIntentReliability.test.ts src/services/pinVoiceParserService.test.ts src/services/__tests__/speechReliability.test.ts
```

### Production Build
```bash
npm run build
```

---

## 📄 License & Attribution

Developed for the **StartupFair Hackathon** (Final Year Mini Project – IT / AI&DS Dept, Sona College of Technology).  
All rights reserved © 2026 AutoFeast AI Team.
