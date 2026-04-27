/**
 * SUMMARIZER AGENT
 * 
 * Responsibilities:
 * - Generate executive summaries
 * - Extract bullet point highlights
 * - Adapt summary style to document type
 */

import Groq from 'groq-sdk';
import { toolRegistry } from './tools';
import { guardrailEngine } from './guardrails';

export interface SummaryResult {
  executiveSummary: string;
  keyHighlights: string[];
  keyNumbers: string[];
  recommendations: string[];
  toolsUsed: string[];
}

export class SummarizerAgent {
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
    
    console.log(`[SUMMARIZER] Initialized with model: ${this.model}`);
  }

  async summarize(
    documentContent: string,
    documentType: string,
    documentTitle: string,
  ): Promise<SummaryResult> {
    console.log(`[SUMMARIZER] Creating summary for: ${documentTitle}`);
    console.log(`[SUMMARIZER] Document type: ${documentType}, Content length: ${documentContent.length}`);

    const toolsUsed: string[] = [];

    try {
      // Check if content is valid
      if (!documentContent || documentContent.trim().length === 0) {
        throw new Error('Document content is empty');
      }

      // Use more content for better summaries (first 8000 chars)
      const contentSample = documentContent.substring(0, 8000);

      // TOOL 3: Get document structure
      console.log('[SUMMARIZER] Using tool: locateSections');
      toolsUsed.push('locateSections');
      const sectionsResult = await toolRegistry.locateSections.execute(documentContent);
      console.log(`[SUMMARIZER] Found ${sectionsResult.sections.length} sections`);

      // Guardrail validation
      const toolCheck = guardrailEngine.validateToolUsage('summarizer', toolsUsed, 'summarization');
      if (!toolCheck.passed) {
        throw new Error(`Tool usage violation: ${toolCheck.reason}`);
      }

      // Tailor prompts based on document type
      const summaryPrompt = this.buildSummaryPrompt(
        contentSample,
        documentType,
        sectionsResult.sections,
      );

      const response = await this.groq.chat.completions.create({
        model: this.model,
        max_tokens: 2000, // Increased for more detailed summaries
        messages: [
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
        temperature: 0.2,
      });

      const contentText = response.choices[0].message.content;
      if (!contentText) {
        throw new Error('Empty response from Groq');
      }

      // Parse the response
      let jsonText = contentText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```/, '');
      }

      let summary;
      try {
        summary = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error(`[SUMMARIZER] Failed to parse JSON response: ${parseError.message}`);
        console.error(`[SUMMARIZER] Raw response: ${jsonText.substring(0, 500)}...`);
        
        // Create a fallback summary
        summary = {
          executiveSummary: 'Unable to parse detailed summary. Here are key points from the document: ' + contentSample.substring(0, 300) + '...',
          keyHighlights: ['Document processed successfully but summary generation failed'],
          keyNumbers: [],
          recommendations: ['Please try asking more specific questions']
        };
      }

      const result: SummaryResult = {
        executiveSummary: summary.executiveSummary || 'No executive summary generated.',
        keyHighlights: summary.keyHighlights || ['No key highlights extracted.'],
        keyNumbers: summary.keyNumbers || [],
        recommendations: summary.recommendations || [],
        toolsUsed,
      };

      console.log(`[SUMMARIZER] Summary complete: Executive summary length: ${result.executiveSummary.length}, ${result.keyHighlights.length} highlights`);
      return result;
    } catch (error: any) {
      console.error(`[SUMMARIZER] Summary failed: ${error.message}`);
      throw new Error(`Summarizer agent failed: ${error.message}`);
    }
  }

  private buildSummaryPrompt(
    content: string,
    documentType: string,
    sections: any[],
  ): string {
    let prompt = `You are creating a comprehensive summary of a ${documentType}. Provide detailed information in this JSON format:

{
  "executiveSummary": "Detailed 4-5 sentence summary covering main purpose, key findings, and significance (150-200 words)",
  "keyHighlights": ["bullet point 1", "bullet point 2", "bullet point 3", "bullet point 4", "bullet point 5", "bullet point 6", "bullet point 7"],
  "keyNumbers": ["important statistic 1 with context", "important statistic 2 with context", "important statistic 3 with context"],
  "recommendations": ["recommendation 1 with explanation", "recommendation 2 with explanation", "recommendation 3 with explanation"]
}

IMPORTANT: Make the summary DETAILED and COMPREHENSIVE. Include specific examples, numbers, and key points.`;

    // Customize based on document type
    if (documentType === 'research_paper') {
      prompt = `For a research paper, provide a COMPREHENSIVE summary focusing on:
1. Research question/hypothesis (clearly stated)
2. Methodology (experimental design, sample size, techniques)
3. Key findings (specific results with numbers/percentages)
4. Statistical significance (p-values, confidence intervals)
5. Limitations (study limitations)
6. Implications (theoretical and practical implications)
7. Future research directions

${prompt}`;
    } else if (documentType === 'business_report') {
      prompt = `For a business report, provide a DETAILED summary focusing on:
1. Executive summary (overall business performance)
2. Key metrics (revenue, growth, market share with numbers)
3. Financial performance (profit margins, ROI, EBITDA)
4. Market analysis (competition, trends, opportunities)
5. SWOT analysis (strengths, weaknesses, opportunities, threats)
6. Strategic recommendations (specific actionable recommendations)
7. Implementation timeline

${prompt}`;
    } else if (documentType === 'legal_policy') {
      prompt = `For a legal/policy document, provide a THOROUGH summary focusing on:
1. Policy objective (primary goal and purpose)
2. Key requirements (specific compliance requirements)
3. Scope and applicability (who/what it applies to)
4. Effective dates and timelines
5. Penalties and enforcement mechanisms
6. Compliance procedures (step-by-step requirements)
7. Exceptions and special cases

${prompt}`;
    } else if (documentType === 'manual_guide') {
      prompt = `For a manual/guide, provide a DETAILED summary focusing on:
1. Purpose and target audience
2. Key features and capabilities
3. Step-by-step procedures
4. Important warnings and precautions
5. Troubleshooting common issues
6. Best practices and tips
7. Maintenance requirements

${prompt}`;
    }

    prompt += `\n\nDocument content (excerpt - first 8000 characters):\n${content}`;

    if (sections.length > 0) {
      prompt += `\n\nDocument sections found:\n${sections.map((s) => `- ${s.title || 'Untitled Section'}: ${s.content ? s.content.substring(0, 150) + '...' : 'No content'}`).join('\n')}`;
    }

    prompt += `\n\nProvide a COMPREHENSIVE and DETAILED summary. Include specific details, numbers, and examples from the document.`;

    return prompt;
  }
}
