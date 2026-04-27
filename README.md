# 📄 Smart PDF Intelligence Platform

A high-performance, multi-agent AI system built to analyze, summarize, and query PDF documents with 100% document grounding. This platform utilizes specialized agents orchestrated to ensure accuracy, speed, and memory efficiency.

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or a Cloud URI)
- Groq API Key

### 1. Backend Setup
```bash
cd backend
npm install
# Create a .env file with:
# GROQ_API_KEY=your_key
# MONGO_URI=mongodb://localhost:27017/pdf-agent
# MAX_PDF_SIZE=20000000
npm run start:dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
# Create a .env.local file with:
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run dev
```

---

## 🤖 Agent Architecture

The system follows a **Modular Orchestration** pattern where a central **Router Agent** evaluates user queries and delegates them to specialized workers.

### Central Components:
- **Router Agent**: The "Brain" that decides which specialist should handle the request based on the user's intent.
- **Worker Agents**: Specialized LLM instances with restricted system prompts and unique toolsets.

---

## 👥 Responsibilities of Each Agent

### 1. Router Agent
- **Goal**: Analyze intent and dispatch to the correct worker.
- **Logic**: Uses zero-shot classification to determine if the user wants an *Analysis*, a *Summary*, or has a *specific Q&A* question.

### 2. Document Analyzer Agent
- **Goal**: Map the structural components of the PDF.
- **Responsibility**: Identifies sections, extracts key themes, and identifies entities (People, Orgs) during the initial ingestion phase.

### 3. Summarizer Agent
- **Goal**: Provide concise, high-level intelligence.
- **Responsibility**: Condenses massive documents into executive summaries while maintaining key highlights.

### 4. Q&A Agent
- **Goal**: Fact-driven interrogation.
- **Responsibility**: Uses semantic retrieval to find specific supporting evidence in the text. It is instructed to strictly say "I don't know" if the answer isn't in the provided chunks.

---

## 🛠️ Tools Used & Why

| Tool | Purpose | Why? |
| :--- | :--- | :--- |
| **PDF Text Extractor** | Raw text parsing | High-speed extraction from complex PDF layouts. |
| **Section Locator** | Structural mapping | Allows the agents to "navigate" the document by page and headers. |
| **Entity Extractor** | Named Entity Recognition | Builds a metadata layer (People, Orgs) for faster filtering. |
| **Semantic Chunk Retriever** | Context injection | Prevents LLM context overflow by only feeding relevant paragraphs (Top-K) to the Q&A agent. |

---

## 🛡️ Guardrails Explanation

To prevent hallucinations and OOM (Out of Memory) crashes, we implemented three layers of safety:

1. **Groundedness Check**: Every response from the Q&A agent is cross-referenced against the retrieved chunks. If the response contains claims not found in the source text, it is flagged.
2. **Relevance Filter**: The Router Agent acts as a primary guardrail, rejecting queries that are outside the scope of document intelligence (e.g., general chat or malicious prompts).
3. **Memory Guardrails**: Our toolset uses streaming-style processing and chunked analysis (50kb limits) to ensure the system never crashes on massive documents.
