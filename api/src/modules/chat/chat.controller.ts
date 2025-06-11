import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ConflictAnalysisService } from './conflict-analysis.service';
import { AuthGuard } from '../auth/auth.guard';
import { RateLimitingGuard } from '../rate-limiting/rate-limiting.guard';
import { AuthUser } from '../auth/auth.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { ConflictAnalysisRequestDto, ConflictAnalysisResponseDto } from './dto/conflict-analysis.dto';

interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@ApiTags('chat')
@Controller('chat')
@UseGuards(AuthGuard, RateLimitingGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly conflictAnalysisService: ConflictAnalysisService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Send a chat message to the AI coach',
    description: 'Routes the message to the appropriate AI model based on user tier',
  })
  @ApiBody({ type: ChatRequestDto })
  @ApiResponse({
    status: 200,
    description: 'AI response generated successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - upgrade to Power tier for unlimited queries',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ChatResponseDto> {
    try {
      const user = req.user;
      
      // Process the chat request (rate limiting is handled by guard)
      const response = await this.chatService.processChat(chatRequest, user);
      
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      console.error('Chat processing error:', error);
      throw new HttpException(
        'An error occurred while processing your request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('conflict-analysis')
  @ApiOperation({
    summary: 'Analyze workplace conflicts with AI-powered insights',
    description: 'Provides detailed conflict analysis including root cause, stakeholder mapping, and resolution strategies',
  })
  @ApiBody({ type: ConflictAnalysisRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Conflict analysis completed successfully',
    type: ConflictAnalysisResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - upgrade to Power tier for unlimited analyses',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async analyzeConflict(
    @Body() analysisRequest: ConflictAnalysisRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ConflictAnalysisResponseDto> {
    try {
      const user = req.user;
      
      // Process the conflict analysis request (rate limiting is handled by guard)
      const response = await this.conflictAnalysisService.analyzeConflict(analysisRequest, user);
      
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      console.error('Conflict analysis error:', error);
      throw new HttpException(
        'An error occurred while processing your conflict analysis request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 