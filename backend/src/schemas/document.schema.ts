import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PDFDocument extends Document {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ required: true })
  uploadDate: Date;

  @Prop({ required: true })
  content: string;

  @Prop({ 
    type: [{
      id: String,
      text: String,
      pageNumber: Number
    }],
    required: true 
  })
  textChunks: Array<{
    id: string;
    text: string;
    pageNumber: number;
  }>;

  @Prop({ required: true })
  documentType: 'research_paper' | 'business_report' | 'legal_policy' | 'manual_guide' | 'unknown';

  @Prop()
  summary: string;

  @Prop({ 
    type: [{
      title: String,
      content: String
    }]
  })
  sections: Array<{
    title: string;
    content: string;
  }>;

  @Prop({ 
    type: {
      totalPages: Number,
      wordCount: Number,
      entities: [String]
    }
  })
  metadata: {
    totalPages: number;
    wordCount: number;
    entities: string[];
  };
}

export const PDFDocumentSchema = SchemaFactory.createForClass(PDFDocument);

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ required: true })
  pdfId: string;

  @Prop({ required: true })
  role: 'user' | 'assistant' | 'router' | 'analyzer';

  @Prop({ required: true })
  content: string;

  @Prop()
  agentType: 'router' | 'analyzer' | 'summarizer' | 'qa';

  @Prop({ type: [String] })
  toolsUsed: string[];

  @Prop()
  reasoning: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
