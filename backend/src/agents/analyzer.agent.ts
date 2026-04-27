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
  private model = 'llama-3.1-8b-instant'; // Faster model for initial indexing to prevent timeouts

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured in environment variables');
    }
    
    this.groq = new Groq({
      apiKey: apiKey,
    });
    
    console.log(`[ANALYZER] Initialized with speed-optimized model: ${this.model}`);
  }

  async analyze(documentContent: string, documentTitle: string): Promise<DocumentAnalysis> {
    console.log(`[ANALYZER] Starting FAST analysis of: ${documentTitle}`);
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
        totalPages: Math.ceil(fullText.length / 3000), // Estimate pages
      };

      // Parallel tool execution for speed
      console.log('[ANALYZER] Executing tools in parallel...');
      const [sectionResult, entityResult] = await Promise.all([
        toolRegistry.locateSections.execute(fullText),
        toolRegistry.extractEntities.execute(fullText)
      ]);

      toolsUsed.push('locateSections', 'extractEntities');
      sections = sectionResult.sections;
      entities = entityResult.entities;

      // Now use Groq for quick interpretation
      const analysisPrompt = `Analyze this document and provide JSON:
1. documentType: research_paper|business_report|legal_policy|manual_guide|unknown
2. keyThemes: 3-5 main topics
3. sectionSummaries: list of {title, summary} (max 50 words per summary)
4. analysis: quick 100-word overview

Content: ${fullText.substring(0, 3000)}
Sections: ${sections.map(s => s.title).join(', ')}

JSON Format:
{
  "documentType": "...",
  "keyThemes": [],
  "sectionSummaries": [{"title": "", "summary": ""}],
  "analysis": "..."
}`;

      const response = await this.groq.chat.completions.create({
        model: this.model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.1,
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
