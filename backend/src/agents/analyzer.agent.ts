/**
 * DOCUMENT ANALYZER AGENT
 * 
 * Responsibilities:
 * - Analyze uploaded PDF content
 * - Identify document type (research paper, business report, legal, manual, etc.)
 * - Extract sections, themes, and important entities
 * - Provide document overview
 */

import Groq from 'groq-sdk';
import { toolRegistry } from './tools';
import { guardrailEngine } from './guardrails';

export interface DocumentAnalysis {
  documentType: 'research_paper' | 'business_report' | 'legal_policy' | 'manual_guide' | 'unknown';
  sections: Array<{ title: string; summary: string }>;
  keyThemes: string[];
  mainEntities: {
    people: string[];
    organizations: string[];
    dates: string[];
    technicalTerms: string[];
  };
  wordCount: number;
  pageCount: number;
  analysis: string;
  toolsUsed: string[];
}

export class DocumentAnalyzerAgent {
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
    
    console.log(`[ANALYZER] Initialized with model: ${this.model}`);
  }

  async analyze(documentContent: string, documentTitle: string): Promise<DocumentAnalysis> {
    console.log(`[ANALYZER] Starting analysis of: ${documentTitle}`);
    console.log(`[ANALYZER] Content length: ${documentContent.length} characters`);

    const toolsUsed: string[] = [];
    let fullText = documentContent;
    let sections: any[] = [];
    let entities: any = {};
    let metadata: any = {};

    try {
      // Check if content is valid
      if (!fullText || fullText.trim().length === 0) {
        throw new Error('Document content is empty');
      }

      // Calculate metadata from content (Memory efficient word count)
      let wordCount = 0;
      const wordMatch = fullText.match(/\S+/g);
      if (wordMatch) {
        wordCount = wordMatch.length;
      }

      metadata = {
        wordCount: wordCount,
        totalPages: Math.ceil(fullText.length / 2500), // Estimate pages
      };

      console.log(`[ANALYZER] Document stats: ${metadata.wordCount} words, ~${metadata.totalPages} pages`);

      // TOOL 1: Locate sections
      console.log('[ANALYZER] Using tool: locateSections');
      toolsUsed.push('locateSections');
      const sectionResult = await toolRegistry.locateSections.execute(fullText);
      sections = sectionResult.sections;
      console.log(`[ANALYZER] Found ${sections.length} sections`);

      // TOOL 4: Extract entities
      console.log('[ANALYZER] Using tool: extractEntities');
      toolsUsed.push('extractEntities');
      const entityResult = await toolRegistry.extractEntities.execute(fullText);
      entities = entityResult.entities;
      console.log(`[ANALYZER] Extracted ${entities.people.length} people, ${entities.organizations.length} organizations`);

      // GUARDRAIL: Tool usage validation
      const toolCheck = guardrailEngine.validateToolUsage('analyzer', toolsUsed, 'document analysis');
      if (!toolCheck.passed) {
        throw new Error(`Tool usage violation: ${toolCheck.reason}`);
      }

      // Now use Groq to interpret the analysis with MORE DETAILS
      const analysisPrompt = `You are a document analyst. Analyze this document thoroughly and provide:

1. Document type classification (research_paper, business_report, legal_policy, manual_guide, or unknown)
2. Key themes and topics (at least 5-7 themes)
3. Detailed summaries of each section (100-150 words each)
4. Overall document purpose and significance
5. Target audience
6. Main conclusions or recommendations

Document content (first 5000 chars for context):
${fullText.substring(0, 5000)}

Sections found:
${sections.map((s) => `- ${s.title || 'Untitled Section'}: ${s.content ? s.content.substring(0, 300) : 'No content'}...`).join('\n')}

Provide your analysis in JSON format with these fields:
{
  "documentType": "research_paper|business_report|legal_policy|manual_guide|unknown",
  "keyThemes": ["theme1", "theme2", "theme3", "theme4", "theme5"],
  "sectionSummaries": [{"title": "section title", "summary": "detailed summary (100-150 words)"}],
  "purpose": "detailed purpose (150-200 words)",
  "analysis": "comprehensive analysis (300-400 words)",
  "targetAudience": "who this document is for",
  "mainConclusions": ["conclusion1", "conclusion2", "conclusion3"]
}`;

      const response = await this.groq.chat.completions.create({
        model: this.model,
        max_tokens: 2000, // Increased for more detailed analysis
        messages: [
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: 0.3,
      });

      const analysisText = response.choices[0].message.content;
      if (!analysisText) {
        throw new Error('Empty response from Groq');
      }

      // Parse the analysis
      let jsonText = analysisText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```/, '');
      }

      let analysis;
      try {
        analysis = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error(`[ANALYZER] Failed to parse JSON response: ${parseError.message}`);
        console.error(`[ANALYZER] Raw response: ${jsonText.substring(0, 500)}...`);
        
        // Create a fallback analysis
        analysis = {
          documentType: 'unknown',
          keyThemes: ['General document'],
          sectionSummaries: [{ title: 'Document', summary: 'Content analyzed successfully but detailed analysis failed.' }],
          purpose: 'Document analysis completed',
          analysis: 'Document processed successfully. ' + fullText.substring(0, 200) + '...'
        };
      }

      const result: DocumentAnalysis = {
        documentType: analysis.documentType || 'unknown',
        sections: analysis.sectionSummaries || [],
        keyThemes: analysis.keyThemes || [],
        mainEntities: entities,
        wordCount: metadata.wordCount,
        pageCount: metadata.totalPages,
        analysis: analysis.analysis || analysis.purpose || 'Document analyzed.',
        toolsUsed,
      };

      console.log(`[ANALYZER] Analysis complete: ${result.documentType}, ${result.keyThemes.length} themes`);
      return result;
    } catch (error: any) {
      console.error(`[ANALYZER] Analysis failed: ${error.message}`);
      throw new Error(`Document analyzer failed: ${error.message}`);
    }
  }
}
