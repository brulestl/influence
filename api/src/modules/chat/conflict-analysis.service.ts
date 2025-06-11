import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../auth/auth.service';
import { 
  ConflictAnalysisRequestDto, 
  ConflictAnalysisResponseDto, 
  ConflictType, 
  ConflictSeverity,
  StakeholderAnalysis 
} from './dto/conflict-analysis.dto';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

@Injectable()
export class ConflictAnalysisService {
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyzeConflict(
    request: ConflictAnalysisRequestDto,
    user: AuthUser,
  ): Promise<ConflictAnalysisResponseDto> {
    const analysisId = uuidv4();
    const timestamp = new Date().toISOString();

    try {
      // Build the analysis prompt
      const analysisPrompt = this.buildAnalysisPrompt(request);
      
      // Get model configuration based on user tier
      const modelConfig = this.getModelConfig(user.tier);
      
      // Call OpenAI for conflict analysis
      const completion = await this.openai.chat.completions.create({
        model: modelConfig.model,
        messages: [
          {
            role: 'system',
            content: modelConfig.systemPrompt,
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        max_tokens: modelConfig.maxTokens,
        temperature: 0.3, // Lower temperature for more consistent analysis
        response_format: { type: 'json_object' },
      });

      const analysisResult = JSON.parse(completion.choices[0]?.message?.content || '{}');
      const tokensUsed = completion.usage?.total_tokens || 0;

      // Structure the response
      const response: ConflictAnalysisResponseDto = {
        id: analysisId,
        timestamp,
        identifiedConflictType: this.mapConflictType(analysisResult.conflictType || request.conflictType),
        assessedSeverity: this.mapSeverity(analysisResult.severity || request.severity),
        rootCauseAnalysis: analysisResult.rootCause || 'Unable to determine root cause from provided information.',
        stakeholderAnalysis: this.parseStakeholderAnalysis(analysisResult.stakeholders || []),
        resolutionStrategies: analysisResult.strategies || [],
        riskAssessment: analysisResult.risks || 'Risk assessment unavailable.',
        recommendedTimeline: analysisResult.timeline || 'Timeline assessment unavailable.',
        usage: {
          tokensUsed,
          analysisComplexity: this.assessComplexity(request),
        },
      };

      return response;
    } catch (error) {
      console.error('Conflict analysis error:', error);
      
      // Fallback to rule-based analysis
      return this.generateFallbackAnalysis(request, analysisId, timestamp);
    }
  }

  private buildAnalysisPrompt(request: ConflictAnalysisRequestDto): string {
    let prompt = `Analyze the following workplace conflict and provide a structured JSON response:

CONFLICT DESCRIPTION:
${request.conflictDescription}

`;

    if (request.conflictType) {
      prompt += `CONFLICT TYPE: ${request.conflictType}\n`;
    }

    if (request.severity) {
      prompt += `PERCEIVED SEVERITY: ${request.severity}\n`;
    }

    if (request.stakeholders && request.stakeholders.length > 0) {
      prompt += `STAKEHOLDERS: ${request.stakeholders.join(', ')}\n`;
    }

    if (request.organizationalContext) {
      prompt += `ORGANIZATIONAL CONTEXT: ${request.organizationalContext}\n`;
    }

    if (request.desiredOutcome) {
      prompt += `DESIRED OUTCOME: ${request.desiredOutcome}\n`;
    }

    prompt += `
Please provide your analysis in the following JSON format:
{
  "conflictType": "one of: interpersonal, team_dynamics, resource_allocation, strategic_disagreement, communication_breakdown, power_struggle, cultural_clash, performance_related",
  "severity": "one of: low, medium, high, critical",
  "rootCause": "detailed analysis of the underlying causes",
  "stakeholders": [
    {
      "name": "stakeholder name or role",
      "influenceLevel": "High/Medium/Low",
      "interests": "their motivations and interests",
      "roleInResolution": "how they can contribute to resolution"
    }
  ],
  "strategies": [
    "specific actionable resolution strategy 1",
    "specific actionable resolution strategy 2",
    "etc."
  ],
  "risks": "assessment of risks if conflict remains unresolved",
  "timeline": "recommended timeline for resolution"
}`;

    return prompt;
  }

  private getModelConfig(tier: string) {
    switch (tier) {
      case 'power':
        return {
          model: 'gpt-4-turbo-preview',
          maxTokens: 3000,
          systemPrompt: 'You are a senior organizational psychologist and conflict resolution expert. Provide sophisticated, evidence-based conflict analysis with deep insights into organizational dynamics, stakeholder psychology, and strategic resolution approaches.',
        };
      case 'essential':
        return {
          model: 'gpt-3.5-turbo',
          maxTokens: 2000,
          systemPrompt: 'You are a workplace conflict resolution specialist. Provide practical, actionable conflict analysis with clear strategies and stakeholder insights.',
        };
      default:
        return {
          model: 'gpt-3.5-turbo',
          maxTokens: 1500,
          systemPrompt: 'You are a workplace advisor specializing in conflict resolution. Provide helpful conflict analysis with practical recommendations.',
        };
    }
  }

  private mapConflictType(type: string): ConflictType {
    const typeMap: { [key: string]: ConflictType } = {
      'interpersonal': ConflictType.INTERPERSONAL,
      'team_dynamics': ConflictType.TEAM_DYNAMICS,
      'resource_allocation': ConflictType.RESOURCE_ALLOCATION,
      'strategic_disagreement': ConflictType.STRATEGIC_DISAGREEMENT,
      'communication_breakdown': ConflictType.COMMUNICATION_BREAKDOWN,
      'power_struggle': ConflictType.POWER_STRUGGLE,
      'cultural_clash': ConflictType.CULTURAL_CLASH,
      'performance_related': ConflictType.PERFORMANCE_RELATED,
    };
    
    return typeMap[type] || ConflictType.INTERPERSONAL;
  }

  private mapSeverity(severity: string): ConflictSeverity {
    const severityMap: { [key: string]: ConflictSeverity } = {
      'low': ConflictSeverity.LOW,
      'medium': ConflictSeverity.MEDIUM,
      'high': ConflictSeverity.HIGH,
      'critical': ConflictSeverity.CRITICAL,
    };
    
    return severityMap[severity] || ConflictSeverity.MEDIUM;
  }

  private parseStakeholderAnalysis(stakeholders: any[]): StakeholderAnalysis[] {
    return stakeholders.map(stakeholder => ({
      name: stakeholder.name || 'Unknown Stakeholder',
      influenceLevel: stakeholder.influenceLevel || 'Medium',
      interests: stakeholder.interests || 'Interests not specified',
      roleInResolution: stakeholder.roleInResolution || 'Role in resolution not specified',
    }));
  }

  private assessComplexity(request: ConflictAnalysisRequestDto): string {
    let complexity = 0;
    
    if (request.stakeholders && request.stakeholders.length > 3) complexity++;
    if (request.organizationalContext && request.organizationalContext.length > 100) complexity++;
    if (request.conflictType === ConflictType.POWER_STRUGGLE || request.conflictType === ConflictType.STRATEGIC_DISAGREEMENT) complexity++;
    if (request.severity === ConflictSeverity.HIGH || request.severity === ConflictSeverity.CRITICAL) complexity++;
    
    if (complexity >= 3) return 'High';
    if (complexity >= 2) return 'Medium';
    return 'Low';
  }

  private generateFallbackAnalysis(
    request: ConflictAnalysisRequestDto,
    analysisId: string,
    timestamp: string,
  ): ConflictAnalysisResponseDto {
    // Rule-based fallback analysis
    const conflictType = request.conflictType || ConflictType.INTERPERSONAL;
    const severity = request.severity || ConflictSeverity.MEDIUM;
    
    const fallbackStrategies = this.getFallbackStrategies(conflictType);
    const fallbackStakeholders = this.generateFallbackStakeholders(request.stakeholders || []);
    
    return {
      id: analysisId,
      timestamp,
      identifiedConflictType: conflictType,
      assessedSeverity: severity,
      rootCauseAnalysis: 'Based on the conflict description, this appears to be a typical workplace disagreement that requires structured intervention and clear communication.',
      stakeholderAnalysis: fallbackStakeholders,
      resolutionStrategies: fallbackStrategies,
      riskAssessment: 'If unresolved, this conflict may impact team productivity, morale, and project outcomes.',
      recommendedTimeline: 'Address within 1-2 weeks to prevent escalation.',
      usage: {
        tokensUsed: 0,
        analysisComplexity: this.assessComplexity(request),
      },
    };
  }

  private getFallbackStrategies(conflictType: ConflictType): string[] {
    const strategyMap: { [key in ConflictType]: string[] } = {
      [ConflictType.INTERPERSONAL]: [
        'Facilitate one-on-one conversations with each party',
        'Arrange mediated discussion to address concerns',
        'Establish clear communication protocols',
        'Focus on shared goals and common ground',
      ],
      [ConflictType.TEAM_DYNAMICS]: [
        'Conduct team building exercises',
        'Clarify roles and responsibilities',
        'Implement regular team check-ins',
        'Address underlying team culture issues',
      ],
      [ConflictType.RESOURCE_ALLOCATION]: [
        'Review and clarify resource allocation criteria',
        'Involve senior management in priority setting',
        'Establish transparent resource request process',
        'Create resource sharing agreements',
      ],
      [ConflictType.STRATEGIC_DISAGREEMENT]: [
        'Escalate to senior leadership for direction',
        'Conduct stakeholder alignment sessions',
        'Document different perspectives and trade-offs',
        'Seek external expert consultation if needed',
      ],
      [ConflictType.COMMUNICATION_BREAKDOWN]: [
        'Implement structured communication protocols',
        'Provide communication skills training',
        'Establish regular status update meetings',
        'Use collaborative tools for transparency',
      ],
      [ConflictType.POWER_STRUGGLE]: [
        'Clarify authority and decision-making processes',
        'Involve HR or senior management',
        'Focus on organizational goals over personal agendas',
        'Consider organizational restructuring if necessary',
      ],
      [ConflictType.CULTURAL_CLASH]: [
        'Provide cultural awareness training',
        'Establish inclusive team norms',
        'Celebrate diversity and different perspectives',
        'Create safe spaces for cultural expression',
      ],
      [ConflictType.PERFORMANCE_RELATED]: [
        'Conduct performance reviews and feedback sessions',
        'Provide additional training or support',
        'Set clear performance expectations',
        'Implement performance improvement plans if needed',
      ],
    };
    
    return strategyMap[conflictType] || strategyMap[ConflictType.INTERPERSONAL];
  }

  private generateFallbackStakeholders(stakeholderNames: string[]): StakeholderAnalysis[] {
    if (stakeholderNames.length === 0) {
      return [
        {
          name: 'Primary Stakeholder',
          influenceLevel: 'High',
          interests: 'Resolution of the conflict',
          roleInResolution: 'Key participant in resolution process',
        },
      ];
    }
    
    return stakeholderNames.map((name, index) => ({
      name,
      influenceLevel: index === 0 ? 'High' : 'Medium',
      interests: 'Successful resolution of the conflict',
      roleInResolution: index === 0 ? 'Primary decision maker' : 'Important contributor to resolution',
    }));
  }
}