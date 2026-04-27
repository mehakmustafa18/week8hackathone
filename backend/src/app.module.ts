import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PDFDocumentSchema } from './schemas/document.schema';
import { ChatMessageSchema } from './schemas/document.schema';
import { DocumentController } from './controllers/document.controller';
import { DocumentService } from './services/document.service';
import { ChatService } from './services/chat.service';
import { appConfig, databaseConfig, groqConfig } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, groqConfig],
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pdf-agent-platform',
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        connectionFactory: (connection) => {
          connection.on('connected', () => {
            console.log('✅ MongoDB Atlas Connected Successfully!');
            console.log('🔗 Database URI:', process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@'));
          });
          connection.on('error', (error: any) => {
            console.error('❌ MongoDB Connection Error:', error.message);
          });
          connection.on('disconnected', () => {
            console.log('⚠️ MongoDB Disconnected');
          });
          return connection;
        },
      }),
    }),
    MongooseModule.forFeature([
      { name: 'PDFDocument', schema: PDFDocumentSchema },
      { name: 'ChatMessage', schema: ChatMessageSchema },
    ]),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, ChatService],
})
export class AppModule {}
