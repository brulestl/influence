import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

describe('AppController', () => {
  let appController: AppController;
  let _appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = module.get<AppController>(AppController);
    _appService = module.get<AppService>(AppService);
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const result = appController.getHealth() as any;
      
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('service', 'Corporate Influence Coach API');
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('getRoot', () => {
    it('should return API information', () => {
      const result = appController.getRoot() as any;
      
      expect(result).toHaveProperty('name', 'Corporate Influence Coach API');
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('endpoints');
      expect(result.endpoints).toHaveProperty('chat', '/api/v1/chat');
    });
  });
}); 