/**
 * ROUTER AGENT
 * 
 * Responsibility:
 * - Understand user intent
 * - Decide which specialized agent should handle the request
 * 
 * HARD RULES:
 * - MUST NOT answer the user
 * - MUST NOT call tools
 * - Only performs routing/delegation
 */

import Groq from 'groq-sdk';
import { guardrailEngine } from './guardrails';

export interface RouterDecision {
  targetAgent: 'analyzer' | 'summarizer' | 'qa';
  confidence: number;
  reasoning: string;
  followUp?: string;
}

export class RouterAgent {
  private groq: Groq;
  private model = 'llama-3.3-70b-versatile';

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment variables');
    }
    
    this.groq = new Groq({
      apiKey: apiKey,
    });
    
    console.log(`[ROUTER] Initialized with model: ${this.model}`);
  }

  async route(userQuery: string, documentTitle: string): Promise<RouterDecision> {
    // GUARDRAIL: Check query safety BEFORE routing
    const safetyCheck = guardrailEngine.checkQuerySafety(userQuery);
    if (!safetyCheck.passed) {
      throw new Error(`Query blocked by guardrails: ${safetyCheck.reason}`);
    }

    const systemPrompt = `You are a request router for a document analysis system. 

Your ONLY job is to understand what the user wants and route it to the correct specialized agent.

ROUTING RULES:
1. If user wants to understand the document structure, identify sections, or get an overview → Route to ANALYZER
2. If user wants a summary, executive summary, or key highlights → Route to SUMMARIZER  
3. If user asks specific questions about document content → Route to QA

CRITICAL RULES:
❌ DO NOT answer the user's question
❌ DO NOT provide analysis or information
❌ DO NOT call any tools
✅ Only decide which agent should handle this

Output ONLY valid JSON (no markdown, no code blocks):
{
  "targetAgent": "analyzer|summarizer|qa",
  "confidence": 0-1,
  "reasoning": "why this agent",
  "followUp": "optional context for the agent"
}`;

    const userPrompt = `Document: "${documentTitle}"
User query: "${userQuery}"

Which agent should handle this? Route it.`;

    try {
      const response = await this.groq.chat.completions.create({
        model: this.model,
        max_tokens: 300,
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
      });

      const contentText = response.choices[0].message.content;
      if (!contentText) {
        throw new Error('Empty response from Groq');
      }

      // Parse JSON response - handle potential markdown wrapping
      let jsonText = contentText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```/, '');
      }

      let decision: RouterDecision;
      try {
        decision = JSON.parse(jsonText) as RouterDecision;
      } catch (parseError: any) {
        console.error(`[ROUTER] Failed to parse JSON response: ${parseError.message}`);
        console.error(`[ROUTER] Raw response: ${jsonText.substring(0, 500)}...`);
        
        // Default to Q&A agent if parsing fails
        decision = {
          targetAgent: 'qa' as const,
          confidence: 0.5,
          reasoning: 'Routing failed, defaulting to Q&A agent.',
          followUp: 'Please try rephrasing your question.'
        };
      }

      // Validate decision structure
      if (!decision || !['analyzer', 'summarizer', 'qa'].includes(decision.targetAgent)) {
        console.warn(`[ROUTER] Invalid target agent: ${decision?.targetAgent}, defaulting to qa`);
        decision = {
          targetAgent: 'qa' as const,
          confidence: 0.5,
          reasoning: 'Invalid routing decision received.',
          followUp: ''
        };
      }

      return decision;
    } catch (error) {
      throw new Error(`Router agent failed: ${error.message}`);
    }
  }
}
