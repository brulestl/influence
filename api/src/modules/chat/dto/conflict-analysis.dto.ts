import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConflictType {
  INTERPERSONAL = 'interpersonal',
  TEAM_DYNAMICS = 'team_dynamics',
  RESOURCE_ALLOCATION = 'resource_allocation',
  STRATEGIC_DISAGREEMENT = 'strategic_disagreement',
  COMMUNICATION_BREAKDOWN = 'communication_breakdown',
  POWER_STRUGGLE = 'power_struggle',
  CULTURAL_CLASH = 'cultural_clash',
  PERFORMANCE_RELATED = 'performance_related',
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class ConflictAnalysisRequestDto {
  @ApiProperty({
    description: 'Description of the conflict situation',
    example: 'Two team leads are disagreeing about project priorities and resource allocation, causing delays and team confusion.',
  })
  @IsString()
  @IsNotEmpty()
  conflictDescription: string;

  @ApiPropertyOptional({
    description: 'Type of conflict being analyzed',
    enum: ConflictType,
    example: ConflictType.RESOURCE_ALLOCATION,
  })
  @IsOptional()
  @IsEnum(ConflictType)
  conflictType?: ConflictType;

  @ApiPropertyOptional({
    description: 'Perceived severity of the conflict',
    enum: ConflictSeverity,
    example: ConflictSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(ConflictSeverity)
  severity?: ConflictSeverity;

  @ApiPropertyOptional({
    description: 'Key stakeholders involved in the conflict',
    type: [String],
    example: ['Team Lead A', 'Team Lead B', 'Project Manager', 'Development Team'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stakeholders?: string[];

  @ApiPropertyOptional({
    description: 'Organizational context or background information',
    example: 'This is happening during a critical product launch phase with tight deadlines.',
  })
  @IsOptional()
  @IsString()
  organizationalContext?: string;

  @ApiPropertyOptional({
    description: 'Desired outcome or resolution goals',
    example: 'Need to resolve quickly while maintaining team morale and meeting project deadlines.',
  })
  @IsOptional()
  @IsString()
  desiredOutcome?: string;
}

export class StakeholderAnalysis {
  @ApiProperty({
    description: 'Name or role of the stakeholder',
    example: 'Team Lead A',
  })
  name: string;

  @ApiProperty({
    description: 'Influence level in the organization',
    example: 'High',
  })
  influenceLevel: string;

  @ApiProperty({
    description: 'Interests and motivations',
    example: 'Wants to prioritize feature development over bug fixes',
  })
  interests: string;

  @ApiProperty({
    description: 'Potential role in resolution',
    example: 'Key decision maker who needs to compromise on priorities',
  })
  roleInResolution: string;
}

export class ConflictAnalysisResponseDto {
  @ApiProperty({
    description: 'Unique analysis ID',
    example: 'analysis_123456',
  })
  id: string;

  @ApiProperty({
    description: 'Analysis timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Identified conflict type',
    enum: ConflictType,
    example: ConflictType.RESOURCE_ALLOCATION,
  })
  identifiedConflictType: ConflictType;

  @ApiProperty({
    description: 'Assessed severity level',
    enum: ConflictSeverity,
    example: ConflictSeverity.MEDIUM,
  })
  assessedSeverity: ConflictSeverity;

  @ApiProperty({
    description: 'Root cause analysis',
    example: 'The conflict stems from unclear project priorities and lack of communication between team leads about resource constraints.',
  })
  rootCauseAnalysis: string;

  @ApiProperty({
    description: 'Detailed stakeholder analysis',
    type: [StakeholderAnalysis],
  })
  stakeholderAnalysis: StakeholderAnalysis[];

  @ApiProperty({
    description: 'Recommended resolution strategies',
    type: [String],
    example: [
      'Schedule immediate alignment meeting with both team leads',
      'Clarify project priorities with senior management',
      'Establish clear resource allocation framework',
      'Implement regular check-ins to prevent future conflicts'
    ],
  })
  resolutionStrategies: string[];

  @ApiProperty({
    description: 'Risk assessment if conflict remains unresolved',
    example: 'High risk of project delays, team morale issues, and potential escalation to senior management.',
  })
  riskAssessment: string;

  @ApiProperty({
    description: 'Recommended timeline for resolution',
    example: 'Immediate action required - resolve within 48 hours to prevent project impact.',
  })
  recommendedTimeline: string;

  @ApiPropertyOptional({
    description: 'Usage statistics',
  })
  usage?: {
    tokensUsed: number;
    analysisComplexity: string;
  };
}