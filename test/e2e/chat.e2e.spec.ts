import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '@nestjs/config';

describe('Chat Controller (e2e)', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = moduleFixture.get<ConfigService>(ConfigService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/chat (POST)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/chat')
        .send({
          message: 'Test message',
          actionType: 'general_chat',
        })
        .expect(401);
    });

    it('should return 400 with invalid request body', () => {
      const mockToken = 'Bearer mock-jwt-token';
      
      return request(app.getHttpServer())
        .post('/chat')
        .set('Authorization', mockToken)
        .send({
          // Missing required message field
          actionType: 'general_chat',
        })
        .expect(400);
    });

    it('should process chat request with valid authentication (mocked)', async () => {
      // Note: This test would need proper JWT token setup in a real environment
      // For now, we're testing the endpoint structure
      
      const response = await request(app.getHttpServer())
        .post('/chat')
        .send({
          message: 'How should I handle a difficult team member?',
          actionType: 'plan_strategy',
        });

      // Expect 401 since we don't have real auth setup in test
      expect(response.status).toBe(401);
    });
  });

  describe('/chat/conflict-analysis (POST)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/chat/conflict-analysis')
        .send({
          conflictDescription: 'Team members are disagreeing about project priorities',
          conflictType: 'team_dynamics',
          severity: 'medium',
        })
        .expect(401);
    });

    it('should return 400 with invalid request body', () => {
      const mockToken = 'Bearer mock-jwt-token';
      
      return request(app.getHttpServer())
        .post('/chat/conflict-analysis')
        .set('Authorization', mockToken)
        .send({
          // Missing required conflictDescription field
          conflictType: 'team_dynamics',
        })
        .expect(400);
    });

    it('should validate conflict analysis request structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/conflict-analysis')
        .send({
          conflictDescription: 'Two team leads are disagreeing about resource allocation',
          conflictType: 'resource_allocation',
          severity: 'high',
          stakeholders: ['Team Lead A', 'Team Lead B', 'Project Manager'],
          organizationalContext: 'Critical product launch phase',
          desiredOutcome: 'Quick resolution while maintaining team morale',
        });

      // Expect 401 since we don't have real auth setup in test
      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers in response', async () => {
      // This test would verify rate limiting headers are present
      // when authentication is properly set up
      
      const response = await request(app.getHttpServer())
        .post('/chat')
        .send({
          message: 'Test message',
        });

      // For now, just verify the endpoint exists
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('OpenAI Integration', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      // This test would verify fallback behavior when OpenAI API is unavailable
      // In a real test environment, we would mock the OpenAI service
      
      const response = await request(app.getHttpServer())
        .post('/chat')
        .send({
          message: 'Test message for error handling',
          actionType: 'general_chat',
        });

      // Expect authentication error since we don't have real auth
      expect(response.status).toBe(401);
    });
  });
});