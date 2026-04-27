import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AgentRunner } from '../agents/runner';
import { ChatMessage } from '../schemas/document.schema';

@Injectable()
export class ChatService {
  private agentRunner: AgentRunner;

  constructor(
    @InjectModel('PDFDocument') private pdfModel: Model<any>,
    @InjectModel('ChatMessage') private chatModel: Model<any>,
  ) {
    this.agentRunner = new AgentRunner(true); // Enable tracing
  }

  /**
   * Process user query and execute multi-agent pipeline
   */
  async processQuery(
    documentId: string,
    userQuery: string,
  ): Promise<{
    response: any;
    messageId: string;
    trace?: any;
  }> {
    try {
      console.log(`[CHAT SERVICE] Processing query for document ${documentId}: ${userQuery}`);
      
      // Get document
      const document = await this.pdfModel.findById(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Check if document has content
      if (!document.content || document.content.trim().length === 0) {
        throw new Error('Document content is empty or not properly extracted');
      }

      console.log(`[CHAT SERVICE] Document found: ${document.filename}, Content length: ${document.content.length} chars`);

      // Execute multi-agent pipeline
      const { response, trace } = await this.agentRunner.executeQuery(
        userQuery,
        document.filename,
        document.content, // Pass content directly instead of file path
        document.content,
      );

      // Store chat message
      const chatMessage = new this.chatModel({
        pdfId: documentId,
        role: 'assistant',
        content: JSON.stringify(response),
        agentType: response.routing?.targetAgent,
        toolsUsed: response.data?.toolsUsed || [],
        reasoning: response.data?.reasoning || '',
      });

      const savedMessage = await chatMessage.save();

      console.log(`[CHAT SERVICE] Query processed successfully, message saved: ${savedMessage._id}`);

      return {
        response,
        messageId: savedMessage._id.toString(),
        trace,
      };
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      console.error(`[CHAT SERVICE] Query processing failed: ${errorMessage}`, error);
      throw new Error(`Query processing failed: ${errorMessage}`);
    }
  }

  /**
   * Get chat history for document
   */
  async getChatHistory(documentId: string, limit = 50): Promise<any[]> {
    return this.chatModel
      .find({ pdfId: documentId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Clear chat history
   */
  async clearChatHistory(documentId: string): Promise<void> {
    await this.chatModel.deleteMany({ pdfId: documentId });
  }

  /**
   * Get execution traces for debugging
   */
  getExecutionTraces(limit = 10): any[] {
    return this.agentRunner.getTraces(limit);
  }

  /**
   * Get specific trace by request ID
   */
  getTraceByRequestId(requestId: string): any {
    return this.agentRunner.getTraceByRequestId(requestId);
  }
}
