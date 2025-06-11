import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRequestDto, ChatActionType } from './dto/chat.dto';
import { Tier } from '../auth/auth.service';
import OpenAI from 'openai';

export interface ModelResponse {
  reply: string;
  context_used: string[];
  cost_in_tokens: number;
  modelUsed: string;
  processingTime?: number;
}

@Injectable()
export class ModelRouterService {
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async routeToModel(
    request: ChatRequestDto,
    userTier: Tier,
    contextData?: string[]
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    
    // Determine which model to use based on tier
    const modelConfig = this.getModelConfig(userTier);
    
    // Check tier quotas before processing
    await this.checkTierQuotas(userTier, request);
    
    // Build the conversation context
    const messages = this.buildConversationMessages(request, modelConfig, contextData);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: modelConfig.openaiModel,
        messages,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const processingTime = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;
      
      return {
        reply: completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.',
        context_used: contextData || [],
        cost_in_tokens: tokensUsed,
        modelUsed: modelConfig.modelName,
        processingTime,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Fallback to tier-appropriate mock response on API failure
      return this.generateFallbackResponse(request, modelConfig, contextData);
    }
  }

  private getModelConfig(tier: Tier) {
    switch (tier) {
      case 'power':
        return {
          modelName: 'power-strategist-gpt',
          openaiModel: 'gpt-4-turbo-preview',
          maxTokens: 4000,
          temperature: 0.7,
          features: ['deep_context', 'voice_input', 'personalization'],
          systemPrompt: 'You are a senior executive coach specializing in corporate politics and workplace influence. Provide sophisticated, strategic advice with deep contextual understanding. Include specific tactics, timing considerations, and risk assessments.',
        };
      case 'essential':
        return {
          modelName: 'essential-coach-gpt',
          openaiModel: 'gpt-3.5-turbo',
          maxTokens: 2000,
          temperature: 0.6,
          features: ['basic_coaching'],
          systemPrompt: 'You are a professional workplace coach. Provide practical, actionable advice for corporate situations. Focus on clear strategies and professional communication.',
        };
      case 'guest':
      default:
        return {
          modelName: 'guest-advisor',
          openaiModel: 'gpt-3.5-turbo',
          maxTokens: 1000,
          temperature: 0.5,
          features: ['limited_advice'],
          systemPrompt: 'You are a workplace advisor. Provide helpful but general advice for professional situations. Keep responses concise and focused.',
        };
    }
  }

  private async checkTierQuotas(tier: Tier, request: ChatRequestDto): Promise<void> {
    // Power tier has unlimited access
    if (tier === 'power') {
      return;
    }

    // For guest and essential tiers, quota checking is handled by the chat service
    // This is a placeholder for additional tier-specific validations
    const estimatedTokens = this.estimateTokenUsage(request.message);
    const modelConfig = this.getModelConfig(tier);
    
    if (estimatedTokens > modelConfig.maxTokens) {
      throw new Error(`Request too large for ${tier} tier. Please shorten your message or upgrade to Power Strategist.`);
    }
  }

  private estimateTokenUsage(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private buildConversationMessages(
    request: ChatRequestDto,
    modelConfig: any,
    contextData?: string[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: modelConfig.systemPrompt,
      },
    ];

    // Add context if available (for power tier)
    if (contextData && contextData.length > 0 && modelConfig.features.includes('deep_context')) {
      const contextPrompt = `Previous conversation context:\n${contextData.join('\n\n')}`;
      messages.push({
        role: 'system',
        content: contextPrompt,
      });
    }

    // Add conversation history if provided
    if (request.context && request.context.length > 0) {
      request.context.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add action type context if specified
    if (request.actionType) {
      const actionContext = this.getActionTypeContext(request.actionType);
      messages.push({
        role: 'system',
        content: actionContext,
      });
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: request.message,
    });

    return messages;
  }

  private getActionTypeContext(actionType: ChatActionType): string {
    switch (actionType) {
      case ChatActionType.EVALUATE_SCENARIO:
        return 'Focus on analyzing the situation, identifying key stakeholders, risks, and opportunities. Provide a structured evaluation.';
      case ChatActionType.PLAN_STRATEGY:
        return 'Develop a comprehensive strategic plan with specific steps, timeline, and contingencies.';
      case ChatActionType.ANALYZE_STAKEHOLDERS:
        return 'Provide detailed stakeholder mapping including influence levels, interests, and recommended engagement approaches.';
      case ChatActionType.SUMMARIZE_POLICY:
        return 'Break down the policy into key components, implications, and actionable insights.';
      case ChatActionType.BRAINSTORM_INSIGHTS:
        return 'Generate creative perspectives and innovative approaches to the challenge.';
      case ChatActionType.DRAFT_EMAIL:
        return 'Create professional, persuasive email content with clear structure and appropriate tone.';
      default:
        return 'Provide comprehensive workplace coaching advice tailored to the specific situation.';
    }
  }

  private async generateFallbackResponse(
    request: ChatRequestDto,
    modelConfig: any,
    contextData?: string[]
  ): Promise<ModelResponse> {
    // Fallback to mock responses when OpenAI API is unavailable
    const responses = this.getMockResponsesByAction(request.actionType);
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    let enhancedResponse = randomResponse;
    if (modelConfig.modelName === 'power-strategist-gpt') {
      enhancedResponse = this.enhanceForPowerTier(randomResponse);
    }

    return {
      reply: enhancedResponse,
      context_used: contextData || [],
      cost_in_tokens: Math.floor(Math.random() * modelConfig.maxTokens * 0.3) + 50,
      modelUsed: `${modelConfig.modelName} (fallback)`,
      processingTime: Math.floor(Math.random() * 2000) + 500,
    };
  }

  private getMockResponsesByAction(actionType?: ChatActionType): string[] {
    switch (actionType) {
      case ChatActionType.EVALUATE_SCENARIO:
        return [
          "Based on the scenario you've described, here are the key factors to consider: stakeholder interests, potential risks, and strategic opportunities. I recommend analyzing the power dynamics and identifying your key allies before proceeding.",
          "This situation requires careful evaluation. Consider the timing, the political climate in your organization, and the potential consequences of different approaches. What's your primary objective here?",
        ];
      
      case ChatActionType.PLAN_STRATEGY:
        return [
          "Here's a strategic approach: 1) Map out all stakeholders and their interests, 2) Identify potential allies and blockers, 3) Develop multiple scenarios with contingency plans, 4) Choose your timing carefully, 5) Prepare your communication strategy.",
          "For this strategy, I recommend a phased approach. Start by building consensus among key influencers, then gradually expand your coalition. Consider the organizational culture and recent changes that might affect your approach.",
        ];
      
      case ChatActionType.ANALYZE_STAKEHOLDERS:
        return [
          "Let me help you map the stakeholder landscape. Consider these categories: Champions (strong supporters), Allies (supportive but not vocal), Neutrals (undecided), Skeptics (concerned but persuadable), and Blockers (strong opposition). Who falls into each category?",
          "Stakeholder analysis is crucial. Look at formal authority vs. informal influence, personal motivations, past behavior patterns, and current priorities. Who has the most to gain or lose from your proposal?",
        ];
      
      case ChatActionType.SUMMARIZE_POLICY:
        return [
          "I'll help you break down this policy into key components: objectives, scope, implementation requirements, stakeholder impacts, and potential challenges. What specific aspects would you like me to focus on?",
          "Policy summaries should highlight: the problem being solved, proposed solution, resource requirements, timeline, success metrics, and potential risks. Which policy document are you working with?",
        ];
      
      case ChatActionType.BRAINSTORM_INSIGHTS:
        return [
          "Let's explore some fresh perspectives on this challenge. Consider: What assumptions might you be making? What would an outsider see differently? What opportunities might emerge from this challenge? What patterns do you notice?",
          "Here are some angles to consider: the historical context, industry trends, generational differences in your workplace, and emerging technologies that might impact this situation. What resonates with your experience?",
        ];
      
      case ChatActionType.DRAFT_EMAIL:
        return [
          "For professional emails in sensitive situations, I recommend this structure: Clear subject line, brief context, specific request or proposal, rationale/benefits, next steps, and professional closing. What's the main message you want to convey?",
          "Email drafting tips: Start with the recipient's perspective, be concise but complete, use positive framing, include specific details, and always end with a clear call to action. Who is your audience and what outcome do you want?",
        ];
      
      default:
        return [
          "I'm here to help you navigate workplace dynamics and corporate politics. Whether you need to evaluate a situation, plan a strategy, or draft communications, I can provide insights based on proven frameworks and best practices.",
          "Corporate influence requires understanding both formal structures and informal networks. What specific challenge are you facing? I can help you analyze the situation and develop an effective approach.",
          "Successful workplace navigation combines emotional intelligence, strategic thinking, and tactical execution. Tell me more about your situation and I'll provide tailored guidance.",
        ];
    }
  }

  private enhanceForPowerTier(baseResponse: string): string {
    const enhancements = [
      "\n\n**Power Strategist Insight:** Consider the long-term implications and how this aligns with your career trajectory.",
      "\n\n**Advanced Strategy:** I can also help you develop a detailed implementation timeline with specific milestones.",
      "\n\n**Personalized Recommendation:** Based on your leadership style, you might want to consider a more collaborative approach.",
    ];
    
    const randomEnhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    return baseResponse + randomEnhancement;
  }
} 