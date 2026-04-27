/**
 * Q&A AGENT
 * 
 * Responsibilities:
 * - Answer user questions STRICTLY from document context
 * - Must clearly state "This information is not present in the document" when applicable
 * - NO hallucination
 * - NO external knowledge
 * 
 * CRITICAL: This agent MUST use the chunk retriever tool
 */

import Groq from 'groq-sdk';
import { toolRegistry } from './tools';
import { guardrailEngine } from './guardrails';

export interface QAResponse {
  answer: string;
  notFound?: boolean;
  sources: Array<{ chunkId: string; relevanceScore: number; excerpt: string }>;
  confidence: number;
  toolsUsed: string[];
  reasoning: string;
}

export class QAAgent {
  private groq: Groq;
  private model = 'llama-3.3-70b-versatile';
  private documentContent: string = '';

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment variables');
    }
    
    this.groq = new Groq({
      apiKey: apiKey,
    });
    
    console.log(`[Q&A] Initialized with model: ${this.model}`);
  }

  async setDocumentContent(content: string) {
    this.documentContent = content;
  }

  async answer(userQuestion: string): Promise<QAResponse> {
    console.log(`[Q&A] Processing question: ${userQuestion}`);

    const toolsUsed: string[] = [];
    const sources: any[] = [];

    if (!this.documentContent) {
      throw new Error('Q&A agent requires document content to be set first');
    }

    try {
      // GUARDRAIL: Check query safety
      const safetyCheck = guardrailEngine.checkQuerySafety(userQuestion);
      if (!safetyCheck.passed) {
        throw new Error(`Query blocked: ${safetyCheck.reason}`);
      }

      // TOOL 2: Retrieve relevant chunks (MANDATORY for Q&A)
      console.log('[Q&A] Using tool: retrieveChunks');
      toolsUsed.push('retrieveChunks');
      const retrievalResult = await toolRegistry.retrieveChunks.execute(
        this.documentContent,
        userQuestion,
      );

      if (retrievalResult.relevantChunks.length === 0) {
        console.log('[Q&A] No relevant chunks found - information not in document');
        return {
          answer: 'This information is not present in the document.',
          notFound: true,
          sources: [],
          confidence: 0,
          toolsUsed,
          reasoning: 'Chunk retrieval found no relevant document sections for this query',
        };
      }

      // Store sources
      sources.push(
        ...retrievalResult.relevantChunks.map((chunk) => ({
          chunkId: chunk.id,
          relevanceScore: chunk.relevanceScore,
          excerpt: chunk.text.substring(0, 200),
        })),
      );

      // Prepare document chunks for guardrail checking
      const documentChunks = retrievalResult.relevantChunks.map((c) => c.text);

      // GUARDRAIL: Tool usage validation
      const toolCheck = guardrailEngine.validateToolUsage('qa', toolsUsed, userQuestion);
      if (!toolCheck.passed) {
        throw new Error(`Tool usage violation: ${toolCheck.reason}`);
      }

      // Build QA prompt with explicit grounding instructions
      const systemPrompt = `You are a strict document Q&A and fact-checking system.

CRITICAL RESPONSIBILITIES & RULES:
1. Answer user questions STRICTLY and ONLY from the provided document chunks context.
2. If the answer is not explicitly present in the chunks, you MUST respond EXACTLY with: "This information is not present in the document."
3. ❌ NO hallucination or guessing.
4. ❌ NO external knowledge.
5. Always cite which chunk the answer comes from.`;

      const userPrompt = `User Question: "${userQuestion}"

Relevant Document Chunks:
${retrievalResult.relevantChunks
  .map(
    (chunk, idx) =>
      `[CHUNK ${chunk.id}] (Relevance: ${(chunk.relevanceScore * 100).toFixed(0)}%)\n${chunk.text}\n`,
  )
  .join('\n---\n\n')}

Provide response in JSON format:
{
  "answer": "Your strict answer based ONLY on chunks above, or EXACTLY 'This information is not present in the document.'",
  "foundInDocument": true/false,
  "sourcesUsed": ["chunk_id_1", "chunk_id_2"],
  "confidence": 0-1,
  "reasoning": "Why you gave this answer"
}`;

      const response = await this.groq.chat.completions.create({
        model: this.model,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.0, // Set to 0 to completely eliminate hallucinations
      });

      const contentText = response.choices[0].message.content;
      if (!contentText) {
        throw new Error('Empty response from Groq');
      }

      // Parse response
      let jsonText = contentText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```/, '');
      }

      let qaResult;
      try {
        qaResult = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error(`[Q&A] Failed to parse JSON response: ${parseError.message}`);
        console.error(`[Q&A] Raw response: ${jsonText.substring(0, 500)}...`);
        
        // If the model bypassed JSON formatting and outputted the strict not found phrase
        if (jsonText.toLowerCase().includes('not present in the document') || 
            jsonText.toLowerCase().includes('information is not present')) {
          qaResult = {
            answer: 'This information is not present in the document.',
            foundInDocument: false,
            sourcesUsed: [],
            confidence: 1.0,
            reasoning: 'Fallback string match for missing info.'
          };
        } else {
          // Create a safe fallback answer without fabricating "found information"
          qaResult = {
            answer: jsonText.substring(0, 500),
            foundInDocument: false, // Default to false if unparseable to avoid false positives
            sourcesUsed: retrievalResult.relevantChunks.map((c: any) => c.id),
            confidence: 0.1,
            reasoning: 'Response parsing failed, using raw response.'
          };
        }
      }

      // STRICT POST-PROCESSING: Enforce rules
      if (!qaResult.foundInDocument || 
          qaResult.answer.toLowerCase().includes('not present in the document')) {
          qaResult.answer = 'This information is not present in the document.';
          qaResult.foundInDocument = false;
      }

      // GUARDRAIL: Check answer groundedness
      const groundedCheck = guardrailEngine.checkAnswerGroundedness(
        qaResult.answer,
        documentChunks,
        userQuestion,
      );

      // GUARDRAIL: Detect hallucinations
      const hallucCheck = guardrailEngine.detectHallucinations(qaResult.answer, this.documentContent);

      if (!groundedCheck.passed || !hallucCheck.passed) {
        console.log('[Q&A] Guardrail triggered - response does not meet groundedness standards');
        return {
          answer: 'This information is not present in the document.', // STRICT format
          notFound: true,
          sources: sources.slice(0, 3),
          confidence: 0,
          toolsUsed,
          reasoning: groundedCheck.reason || hallucCheck.reason || 'Response failed groundedness check',
        };
      }

      const result: QAResponse = {
        answer: qaResult.answer,
        notFound: !qaResult.foundInDocument,
        sources: sources.slice(0, 3), // Return top 3 sources
        confidence: qaResult.confidence,
        toolsUsed,
        reasoning: qaResult.reasoning,
      };

      console.log('[Q&A] Answer provided with confidence:', result.confidence);
      return result;
    } catch (error) {
      throw new Error(`Q&A agent failed: ${error.message}`);
    }
  }
}
