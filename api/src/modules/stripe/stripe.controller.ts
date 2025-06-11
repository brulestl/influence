import { Controller, Post, Headers, Body, HttpException, HttpStatus, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { SkipRateLimit } from '../rate-limiting/skip-rate-limit.decorator';

@ApiTags('stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('webhook')
  @SkipRateLimit()
  @ApiExcludeEndpoint() // Exclude from Swagger docs for security
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new HttpException('Missing stripe-signature header', HttpStatus.BAD_REQUEST);
    }

    if (!req.rawBody) {
      throw new HttpException('Missing request body', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.stripeService.handleWebhook(signature, req.rawBody);
      return { received: true };
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}