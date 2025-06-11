import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConflictAnalysisService } from './conflict-analysis.service';
import { ModelRouterService } from './model-router.service';
import { RAGModule } from '../rag/rag.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitingModule } from '../rate-limiting/rate-limiting.module';

@Module({
  imports: [RAGModule, AuthModule, RateLimitingModule],
  controllers: [ChatController],
  providers: [ChatService, ConflictAnalysisService, ModelRouterService],
  exports: [ChatService, ConflictAnalysisService, ModelRouterService],
})
export class ChatModule {} 