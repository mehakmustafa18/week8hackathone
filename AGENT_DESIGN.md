# 🧠 Agent Design Notes

## 1. Why Agents were Separated

In this platform, we opted for a **Specalist Agent Architecture** (Router-Worker pattern) rather than a single "God Agent."

### Reasons for Separation:
- **Prompt Precision**: A Q&A agent needs to be grounded and cautious, while an Analyzer needs to be expansive and creative in identifying themes. Combining these results in "Prompt Dilution," where the agent becomes mediocre at everything.
- **Context Window Management**: Workers only receive tools relevant to their task. This reduces tokens and prevents the agent from getting "distracted" by irrelevant tools.
- **Error Isolation**: If the Summarizer agent fails or hallucinates, it doesn't affect the Q&A agent's ability to provide factual answers. 

---

## 2. What breaks if merged into one agent?

If we merged these into a single agent (Unified LLM):

1. **Hallucination Spikes**: The agent would struggle to maintain the strict "grounding" required for Q&A while trying to perform broad analysis. It often confuses the user's intent, providing a summary when a specific fact was requested.
2. **Infinite Loops (Tool Switching)**: A unified agent often spends too much time deciding which tool to use. It might try to use the `EntityExtractor` to answer a simple question, leading to high latency and unnecessary API costs.
3. **Memory OOM Crashes**: A single agent would attempt to load all document chunks into memory to perform all tasks simultaneously. Our separated architecture allows the Summarizer to process the document in a stream, while the Q&A agent only fetches the top 10 relevant chunks.

---

## 3. What would improve in Production?

While the current system is stable and performant, a production-grade deployment would benefit from:

- **Vector Database (Pinecone/Milvus)**: Currently, we use in-memory semantic retrieval. For documents with thousands of pages, a dedicated vector DB would offer sub-millisecond retrieval.
- **Agent Self-Correction (Reflection)**: Implementing a `Critic Agent` that reviews the output of the workers before it reaches the user.
- **Streaming Responses (WebSockets)**: Improving the UX by streaming the LLM output word-by-word instead of waiting for the full buffer.
- **Multi-Modal Analysis**: Using Vision models (like Llama-3.2-Vision) to analyze charts, tables, and images within the PDFs, which are currently ignored by the text-based extractors.
