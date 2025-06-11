import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitingService } from './rate-limiting.service';
import { AuthUser } from '../auth/auth.service';

@Injectable()
export class RateLimitingGuard implements CanActivate {
  constructor(
    private readonly rateLimitingService: RateLimitingService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if rate limiting is disabled for this endpoint
    const skipRateLimit = this.reflector.get<boolean>('skipRateLimit', context.getHandler());
    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    if (!user) {
      // If no user is authenticated, let the auth guard handle it
      return true;
    }

    // Check rate limit
    const rateLimit = await this.rateLimitingService.checkRateLimit(user);

    if (!rateLimit.allowed) {
      const resetTimeString = rateLimit.resetTime.toISOString();
      
      throw new HttpException(
        {
          message: `Daily query limit exceeded. You have used all ${this.getMaxQueries(user.tier)} queries for today.`,
          code: 'RATE_LIMIT_EXCEEDED',
          resetTime: resetTimeString,
          upgradeUrl: user.tier !== 'power' ? '/upgrade' : undefined,
          tier: user.tier,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit info to response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', this.getMaxQueries(user.tier));
    response.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    response.setHeader('X-RateLimit-Reset', Math.floor(rateLimit.resetTime.getTime() / 1000));

    // Increment usage after successful check
    await this.rateLimitingService.incrementUsage(user);

    return true;
  }

  private getMaxQueries(tier: string): number {
    switch (tier) {
      case 'power':
        return -1; // Unlimited
      case 'essential':
        return 3;
      case 'guest':
      default:
        return 3;
    }
  }
}