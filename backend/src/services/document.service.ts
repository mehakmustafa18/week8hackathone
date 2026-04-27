import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DocumentAnalyzerAgent } from '../agents/analyzer.agent';
import { toolRegistry } from '../agents/tools';
import { PDFDocument } from '../schemas/document.schema';

@Injectable()
export class DocumentService {
  private analyzerAgent: DocumentAnalyzerAgent;

  constructor(
    @InjectModel('PDFDocument') private pdfModel: Model<any>,
  ) {
    this.analyzerAgent = new DocumentAnalyzerAgent();
  }

  /**
   * Process uploaded PDF file
   */
  async processPDF(
    file: any,
    originalName: string,
  ): Promise<{
    documentId: string;
    analysis: any;
  }> {
    try {
      console.log(`[DOCUMENT SERVICE] Processing PDF: ${originalName}, Size: ${file.size} bytes`);
      
      const fileName = `pdf_${Date.now()}.pdf`;
      const uploadPath = path.join(os.tmpdir(), fileName);

      if (!file || !file.buffer) {
        console.error('[DOCUMENT SERVICE] File buffer missing. Check multipart configuration.');
        throw new Error('File buffer is empty. Please ensure the file was uploaded correctly.');
      }

      // Save file temporarily
      fs.writeFileSync(uploadPath, file.buffer);
      console.log(`[DOCUMENT SERVICE] File saved to temporary storage: ${uploadPath}`);

      // Extract PDF content
      console.log('[DOCUMENT SERVICE] Extracting PDF content...');
      const extraction = await toolRegistry.extractPDF.execute(uploadPath);
      console.log(`[DOCUMENT SERVICE] PDF extracted: ${extraction.metadata.totalPages} pages, ${extraction.metadata.wordCount} words`);
      
      // Check if extraction was successful
      if (!extraction.fullText || extraction.fullText.trim().length === 0) {
        throw new Error('PDF extraction failed - no text content found. The PDF might be scanned or encrypted.');
      }

      // Analyze document using the extracted content
      console.log('[DOCUMENT SERVICE] Analyzing document with analyzer agent...');
      const analysis = await this.analyzerAgent.analyze(extraction.fullText, originalName);
      console.log(`[DOCUMENT SERVICE] Analysis complete: ${analysis.documentType}`);

      // Save to MongoDB
      const pdfDocument = new this.pdfModel({
        filename: originalName,
        fileSize: file.size,
        uploadDate: new Date(),
        content: extraction.fullText,
        textChunks: extraction.pages.map((page, idx) => ({
          id: `page_${idx + 1}`,
          text: page.text,
          pageNumber: page.pageNumber,
        })),
        documentType: analysis.documentType,
        summary: analysis.analysis,
        sections: analysis.sections,
        metadata: {
          totalPages: extraction.metadata.totalPages,
          wordCount: extraction.metadata.wordCount,
          entities: [
            ...analysis.mainEntities.people,
            ...analysis.mainEntities.organizations,
            ...analysis.mainEntities.technicalTerms,
          ],
        },
      });

      const savedDoc = await pdfDocument.save();
      console.log(`[DOCUMENT SERVICE] Document saved to MongoDB with ID: ${savedDoc._id}`);

      // Clean up temp file
      fs.unlinkSync(uploadPath);
      console.log(`[DOCUMENT SERVICE] Temp file cleaned up: ${uploadPath}`);

      return {
        documentId: savedDoc._id.toString(),
        analysis: {
          documentType: analysis.documentType,
          sections: analysis.sections,
          keyThemes: analysis.keyThemes,
          entities: analysis.mainEntities,
          wordCount: analysis.wordCount,
          pageCount: analysis.pageCount,
          summary: analysis.analysis,
        },
      };
    } catch (error: any) {
      console.error(`[DOCUMENT SERVICE] PDF processing failed: ${error.message}`);
      console.error(`[DOCUMENT SERVICE] Error stack: ${error.stack}`);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      
      if (error.message.includes('MongoNetworkError') || error.message.includes('connection')) {
        errorMessage = 'Database connection failed. Please check MongoDB connection.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Operation timed out. Please try again with a smaller file.';
      } else if (error.message.includes('PDF extraction failed')) {
        errorMessage = 'Could not extract text from PDF. The file might be scanned, encrypted, or corrupted.';
      }
      
      throw new Error(`PDF processing failed: ${errorMessage}`);
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<any> {
    const doc = await this.pdfModel.findById(documentId);
    if (!doc) {
      throw new Error('Document not found');
    }
    return doc;
  }

  /**
   * List all documents
   */
  async listDocuments(): Promise<any[]> {
    return this.pdfModel
      .find({}, { content: 0, textChunks: 0 }) // Exclude large content fields
      .sort({ uploadDate: -1 })
      .exec();
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.pdfModel.findByIdAndDelete(documentId);
  }
}
