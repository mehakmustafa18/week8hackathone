import pdfParse from 'pdf-parse';
import * as fs from 'fs';

/**
 * TOOL 1: PDF Text Extraction Tool
 * Extracts text from PDF with page tracking
 */
export class PDFTextExtractorTool {
  async execute(filePath: string): Promise<{
    fullText: string;
    pages: Array<{ pageNumber: number; text: string }>;
    metadata: { totalPages: number; wordCount: number };
  }> {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(fileBuffer);

      const fullText = pdfData.text || '';
      const wordCount = fullText.split(/\s+/).length;

      // pdf-parse doesn't provide per-page text by default
      // Split text into pages based on page count
      const totalPages = pdfData.numpages;
      const avgCharsPerPage = Math.ceil(fullText.length / totalPages);
      const pages: Array<{ pageNumber: number; text: string }> = [];
      
      for (let i = 0; i < totalPages; i++) {
        const start = i * avgCharsPerPage;
        const end = Math.min((i + 1) * avgCharsPerPage, fullText.length);
        pages.push({
          pageNumber: i + 1,
          text: fullText.substring(start, end),
        });
      }

      return {
        fullText,
        pages,
        metadata: {
          totalPages: pdfData.numpages,
          wordCount,
        },
      };
    } catch (error: any) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }
}

/**
 * TOOL 2: Semantic Chunk Retriever
 * Splits text into meaningful chunks and retrieves relevant ones
 */
export class SemanticChunkRetrieverTool {
  private chunkSize: number = 1000;
  private overlapSize: number = 100;

  async execute(text: string, query: string): Promise<{
    relevantChunks: Array<{ id: string; text: string; relevanceScore: number }>;
    totalChunks: number;
  }> {
    const queryKeywords = query.toLowerCase().split(/\s+/).filter(k => k.trim().length > 0);
    
    let bestChunks: Array<{ id: string; text: string; relevanceScore: number }> = [];
    let chunkCount = 0;
    
    // Process text in chunks without allocating a massive array of all chunks
    let currentIdx = 0;
    const increment = Math.max(1, this.chunkSize - this.overlapSize);

    while (currentIdx < text.length) {
      const endIdx = Math.min(currentIdx + this.chunkSize, text.length);
      const chunkText = text.substring(currentIdx, endIdx);
      const lowerText = chunkText.toLowerCase();
      
      let score = 0;
      for (const keyword of queryKeywords) {
        let pos = lowerText.indexOf(keyword);
        while (pos !== -1) {
          score++;
          pos = lowerText.indexOf(keyword, pos + 1); // Overlapping matches allowed for scoring
        }
      }
      
      if (score > 0) {
        bestChunks.push({
          id: `chunk_${chunkCount}`,
          text: chunkText,
          relevanceScore: score
        });
        
        // Keep memory low by sorting and pruning during iteration
        if (bestChunks.length > 20) {
           bestChunks.sort((a,b) => b.relevanceScore - a.relevanceScore);
           bestChunks = bestChunks.slice(0, 10);
        }
      }
      
      chunkCount++;
      currentIdx += increment;
    }
    
    bestChunks.sort((a,b) => b.relevanceScore - a.relevanceScore);
    const finalResult = bestChunks.slice(0, 5);

    return {
      relevantChunks: finalResult,
      totalChunks: chunkCount,
    };
  }
}

/**
 * TOOL 3: Section Locator Tool
 * Identifies document sections and structure
 */
export class SectionLocatorTool {
  async execute(text: string): Promise<{
    sections: Array<{ title: string; startIdx: number; endIdx: number; content: string }>;
    documentStructure: string;
  }> {
    // Common section patterns
    const patterns = [
      /^(introduction|summary|abstract|executive\s+summary)/im,
      /^(methodology|approach|background)/im,
      /^(results|findings|analysis)/im,
      /^(conclusion|discussion|recommendations)/im,
      /^(references|bibliography|appendix)/im,
    ];

    const lines = text.split('\n');
    const sections = [];
    let currentSectionTitle = null;
    let currentContentLines: string[] = [];
    let sectionStartIdx = 0;
    let runningIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLenWithNewline = line.length + 1; // +1 for the \n

      // Check if this line is a section header
      let isSectionHeader = false;
      for (const pattern of patterns) {
        if (pattern.test(line) && line.length < 100) {
          isSectionHeader = true;
          break;
        }
      }

      if (isSectionHeader) {
        // Save previous section if exists
        if (currentSectionTitle) {
          sections.push({
            title: currentSectionTitle,
            content: currentContentLines.join('\n').trim(),
            startIdx: sectionStartIdx,
            endIdx: runningIdx
          });
        }
        currentSectionTitle = line;
        currentContentLines = [];
        sectionStartIdx = runningIdx;
      } else if (currentSectionTitle) {
        currentContentLines.push(line);
      }
      
      runningIdx += lineLenWithNewline;
    }

    // Add last section
    if (currentSectionTitle) {
      sections.push({
        title: currentSectionTitle,
        content: currentContentLines.join('\n').trim(),
        startIdx: sectionStartIdx,
        endIdx: text.length,
      });
    }

    return {
      sections: sections.filter((s) => s.content.length > 0),
      documentStructure: sections.map((s) => `- ${s.title}`).join('\n'),
    };
  }
}

/**
 * TOOL 4: Entity Extractor Tool
 * Extracts important entities (names, dates, technical terms)
 */
export class EntityExtractorTool {
  async execute(text: string): Promise<{
    entities: {
      people: string[];
      organizations: string[];
      dates: string[];
      technicalTerms: string[];
    };
  }> {
    const people: Set<string> = new Set();
    const organizations: Set<string> = new Set();
    const dates: Set<string> = new Set();
    const technicalTerms: Set<string> = new Set();

    // REGEX FIX: Simplified regex to prevent catastrophic backtracking (ReDoS)
    const personRegex = /[A-Z][a-z]+/g; // Just match capitalized words and let Set/Logic handle phrases
    let match;
    let count = 0;
    
    // Only analyze the first 50kb for entities - plenty for metadata
    const analysisLimit = Math.min(text.length, 50000);
    const textToAnalyze = text.substring(0, analysisLimit);

    while ((match = personRegex.exec(textToAnalyze)) !== null && count < 50) {
      if (match[0].length > 3) {
        people.add(match[0]);
        count++;
      }
    }

    // Find dates with a safe loop
    const datePatterns = [/\d{1,2}\/\d{1,2}\/\d{4}/g, /\d{4}-\d{1,2}-\d{1,2}/g, /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/gi];

    datePatterns.forEach((pattern) => {
      let dateMatch;
      let dateCount = 0;
      while ((dateMatch = pattern.exec(textToAnalyze)) !== null && dateCount < 20) {
        dates.add(dateMatch[0]);
        dateCount++;
      }
    });

    // Technical terms (words followed by specific indicators)
    const technicalPattern = /(?:algorithm|method|protocol|system|framework|model|approach|technique|process)\s+(?:called|named|is|named\s+)([A-Za-z0-9\-_]+)/gi;
    let techMatch;
    let techCount = 0;
    while ((techMatch = technicalPattern.exec(textToAnalyze)) !== null && techCount < 20) {
      if (techMatch[1]) {
        technicalTerms.add(techMatch[1]);
        techCount++;
      }
    }

    return {
      entities: {
        people: Array.from(people).slice(0, 10),
        organizations: Array.from(organizations).slice(0, 10),
        dates: Array.from(dates).slice(0, 10),
        technicalTerms: Array.from(technicalTerms).slice(0, 10),
      },
    };
  }
}

export const toolRegistry = {
  extractPDF: new PDFTextExtractorTool(),
  retrieveChunks: new SemanticChunkRetrieverTool(),
  locateSections: new SectionLocatorTool(),
  extractEntities: new EntityExtractorTool(),
};
