import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from '../services/document.service';
import { ChatService } from '../services/chat.service';

@Controller('api')
export class DocumentController {
  constructor(
    private documentService: DocumentService,
    private chatService: ChatService,
  ) {}

  /**
   * Upload and process PDF
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPDF(
    @UploadedFile() file: any,
  ): Promise<any> {
    try {
      console.log(`[CONTROLLER] Upload request received`);
      
      if (!file) {
        throw new BadRequestException('No file provided. Please select a PDF file to upload.');
      }

      console.log(`[CONTROLLER] File details: ${file.originalname}, ${file.size} bytes, ${file.mimetype}`);

      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException(`Only PDF files are allowed. Received file type: ${file.mimetype}`);
      }

      const maxSize = parseInt(process.env.MAX_PDF_SIZE || '20000000');
      if (file.size > maxSize) {
        throw new BadRequestException(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB, Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      console.log(`[CONTROLLER] Processing PDF with document service...`);
      const result = await this.documentService.processPDF(file, file.originalname);

      console.log(`[CONTROLLER] Upload successful, document ID: ${result.documentId}`);

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error(`[CONTROLLER] Upload failed: ${error.message}`);
      console.error(`[CONTROLLER] Error stack: ${error.stack}`);
      
      // Re-throw with better message
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`PDF processing failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get document details
   */
  @Get('documents/:id')
  async getDocument(@Param('id') documentId: string): Promise<any> {
    const document = await this.documentService.getDocument(documentId);

    return {
      success: true,
      data: {
        id: document._id,
        filename: document.filename,
        documentType: document.documentType,
        uploadDate: document.uploadDate,
        fileSize: document.fileSize,
        metadata: document.metadata,
        sections: document.sections,
        summary: document.summary,
      },
    };
  }

  /**
   * List all documents
   */
  @Get('documents')
  async listDocuments(): Promise<any> {
    const documents = await this.documentService.listDocuments();

    return {
      success: true,
      data: documents.map((doc) => ({
        id: doc._id,
        filename: doc.filename,
        documentType: doc.documentType,
        uploadDate: doc.uploadDate,
        fileSize: doc.fileSize,
      })),
    };
  }

  /**
   * Delete document
   */
  @Delete('documents/:id')
  async deleteDocument(@Param('id') documentId: string): Promise<any> {
    await this.documentService.deleteDocument(documentId);
    await this.chatService.clearChatHistory(documentId);

    return {
      success: true,
      message: 'Document deleted',
    };
  }

  /**
   * Ask question about document (Multi-Agent Pipeline)
   */
  @Post('documents/:id/ask')
  async askQuestion(
    @Param('id') documentId: string,
    @Body('query') query: string,
  ): Promise<any> {
    if (!query || typeof query !== 'string') {
      throw new BadRequestException('Query is required');
    }

    const result = await this.chatService.processQuery(documentId, query);

    return {
      success: true,
      data: {
        messageId: result.messageId,
        response: result.response,
      },
      trace: result.trace, // Include trace for debugging
    };
  }

  /**
   * Get chat history
   */
  @Get('documents/:id/chat-history')
  async getChatHistory(
    @Param('id') documentId: string,
  ): Promise<any> {
    const history = await this.chatService.getChatHistory(documentId);

    return {
      success: true,
      data: history,
    };
  }

  /**
   * Get execution traces (for debugging agent behavior)
   */
  @Get('traces')
  async getTraces(): Promise<any> {
    const traces = this.chatService.getExecutionTraces(10);

    return {
      success: true,
      data: traces,
    };
  }

  /**
   * Get specific trace by request ID
   */
  @Get('traces/:requestId')
  async getTraceByRequestId(@Param('requestId') requestId: string): Promise<any> {
    const trace = this.chatService.getTraceByRequestId(requestId);

    if (!trace) {
      throw new BadRequestException('Trace not found');
    }

    return {
      success: true,
      data: trace,
    };
  }

  /**
   * Health check
   */
  @Get('health')
  async health(): Promise<any> {
    return {
      success: true,
      message: 'Agent Platform is running',
    };
  }
}
