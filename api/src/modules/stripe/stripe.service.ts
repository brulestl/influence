import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-05-28.basil',
    });

    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '',
    );
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      throw new Error('Invalid webhook signature');
    }

    console.log('Processing Stripe webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.Invoice);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    try {
      const customerId = subscription.customer as string;
      const status = subscription.status;
      const priceId = subscription.items.data[0]?.price.id;

      // Get user by Stripe customer ID
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('stripe_customer_id', customerId)
        .single();

      if (userError || !user) {
        console.error('User not found for customer ID:', customerId);
        return;
      }

      // Determine tier based on price ID
      const tier = this.getTierFromPriceId(priceId);
      const isActive = status === 'active' || status === 'trialing';

      // Update user tier and subscription status
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          tier: isActive ? tier : 'essential',
          subscription_status: status,
          subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update user subscription:', updateError);
        return;
      }

      console.log(`Updated user ${user.email} to tier ${tier} with status ${status}`);
    } catch (error) {
      console.error('Error handling subscription change:', error);
    }
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    try {
      const customerId = subscription.customer as string;

      // Get user by Stripe customer ID
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('stripe_customer_id', customerId)
        .single();

      if (userError || !user) {
        console.error('User not found for customer ID:', customerId);
        return;
      }

      // Downgrade user to essential tier
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          tier: 'essential',
          subscription_status: 'canceled',
          subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to downgrade user after cancellation:', updateError);
        return;
      }

      console.log(`Downgraded user ${user.email} to essential tier after cancellation`);
    } catch (error) {
      console.error('Error handling subscription cancellation:', error);
    }
  }

  private async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    try {
      const customerId = invoice.customer as string;
      // For subscription invoices, the subscription field should be present
      const subscriptionId = (invoice as any).subscription;

      if (!subscriptionId) {
        return; // Not a subscription payment
      }

      // Get user by Stripe customer ID
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('stripe_customer_id', customerId)
        .single();

      if (userError || !user) {
        console.error('User not found for customer ID:', customerId);
        return;
      }

      // Update payment status and reset any trial flags
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          last_payment_date: new Date().toISOString(),
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update payment status:', updateError);
        return;
      }

      console.log(`Payment successful for user ${user.email}`);
    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  }

  private async handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    try {
      const customerId = invoice.customer as string;

      // Get user by Stripe customer ID
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, email')
        .eq('stripe_customer_id', customerId)
        .single();

      if (userError || !user) {
        console.error('User not found for customer ID:', customerId);
        return;
      }

      // Update payment status
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update payment failure status:', updateError);
        return;
      }

      console.log(`Payment failed for user ${user.email}`);
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  private getTierFromPriceId(priceId?: string): 'essential' | 'power' {
    // Map Stripe price IDs to tiers
    const powerPriceIds = [
      this.configService.get<string>('STRIPE_POWER_PRICE_ID'),
      // Add other power tier price IDs here
    ].filter(Boolean);

    if (priceId && powerPriceIds.includes(priceId)) {
      return 'power';
    }

    return 'essential'; // Default fallback
  }

  // Method to create a customer in Stripe
  async createCustomer(email: string, userId: string): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        metadata: {
          user_id: userId,
        },
      });

      return customer.id;
    } catch (error) {
      console.error('Failed to create Stripe customer:', error);
      throw error;
    }
  }

  // Method to create a checkout session
  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return session.url || '';
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw error;
    }
  }

  // Method to get subscription details
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Failed to retrieve subscription:', error);
      return null;
    }
  }
}