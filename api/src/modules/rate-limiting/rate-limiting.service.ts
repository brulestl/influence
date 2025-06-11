import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser, Tier } from '../auth/auth.service';

interface UserQuota {
  userId: string;
  tier: Tier;
  dailyQueries: number;
  lastReset: Date;
  maxQueries: number;
}

@Injectable()
export class RateLimitingService {
  private userQuotas = new Map<string, UserQuota>();

  constructor(private readonly configService: ConfigService) {}

  async checkRateLimit(user: AuthUser): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    // Power tier users have unlimited access
    if (user.tier === 'power') {
      return {
        allowed: true,
        remaining: -1, // Unlimited
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
      };
    }

    const userId = user.id;
    const now = new Date();
    const maxQueries = this.getMaxQueries(user.tier);
    
    // Get or create user quota
    let userQuota = this.userQuotas.get(userId);
    
    if (!userQuota || this.shouldResetQuota(userQuota.lastReset, now)) {
      userQuota = {
        userId,
        tier: user.tier,
        dailyQueries: 0,
        lastReset: now,
        maxQueries,
      };
      this.userQuotas.set(userId, userQuota);
    }

    // Check if user has exceeded their limit
    const allowed = userQuota.dailyQueries < maxQueries;
    const remaining = Math.max(0, maxQueries - userQuota.dailyQueries);
    const resetTime = new Date(userQuota.lastReset.getTime() + 24 * 60 * 60 * 1000);

    return {
      allowed,
      remaining,
      resetTime,
    };
  }

  async incrementUsage(user: AuthUser): Promise<void> {
    // Power tier users don't have usage limits
    if (user.tier === 'power') {
      return;
    }

    const userId = user.id;
    const userQuota = this.userQuotas.get(userId);
    
    if (userQuota) {
      userQuota.dailyQueries++;
      this.userQuotas.set(userId, userQuota);
    }
  }

  async getRemainingQueries(user: AuthUser): Promise<number> {
    const rateLimit = await this.checkRateLimit(user);
    return rateLimit.remaining;
  }

  private getMaxQueries(tier: Tier): number {
    switch (tier) {
      case 'power':
        return -1; // Unlimited
      case 'essential':
        return 3; // 3 queries per day
      case 'guest':
      default:
        return 3; // 3 queries per day
    }
  }

  private shouldResetQuota(lastReset: Date, now: Date): boolean {
    // Reset quota if it's been more than 24 hours
    const timeDiff = now.getTime() - lastReset.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    return hoursDiff >= 24;
  }

  // Method to get usage statistics for monitoring
  async getUsageStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    tierDistribution: Record<Tier, number>;
  }> {
    const stats = {
      totalUsers: this.userQuotas.size,
      activeUsers: 0,
      tierDistribution: {
        guest: 0,
        essential: 0,
        power: 0,
      } as Record<Tier, number>,
    };

    const now = new Date();
    
    for (const quota of this.userQuotas.values()) {
      // Count as active if used within last 24 hours
      if (!this.shouldResetQuota(quota.lastReset, now) && quota.dailyQueries > 0) {
        stats.activeUsers++;
      }
      
      stats.tierDistribution[quota.tier]++;
    }

    return stats;
  }

  // Method to clean up old quota records (should be called periodically)
  async cleanupOldQuotas(): Promise<void> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    for (const [userId, quota] of this.userQuotas.entries()) {
      if (quota.lastReset < cutoffTime) {
        this.userQuotas.delete(userId);
      }
    }
  }
}