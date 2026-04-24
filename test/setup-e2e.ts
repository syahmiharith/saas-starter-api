import { applyTestEnvDefaults } from './helpers/env';

applyTestEnvDefaults();
process.env.STRIPE_PRICE_PRO = 'price_test_pro';
process.env.STRIPE_PRICE_TEAM = 'price_test_team';

jest.mock('stripe', () => {
  const constructEvent = jest.fn((body: Buffer | string, signature: string | undefined) => {
    if (!signature) {
      throw new Error('Missing signature');
    }
    return JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : body);
  });

  const stripeClient = jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn().mockResolvedValue({ id: `cus_test_${Date.now()}` })
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: `cs_test_${Date.now()}`,
          url: 'https://checkout.stripe.com/c/pay/cs_test_local'
        })
      }
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: `bps_test_${Date.now()}`,
          url: 'https://billing.stripe.com/p/session/test'
        })
      }
    },
    webhooks: {
      constructEvent
    }
  }));

  return {
    __esModule: true,
    default: stripeClient
  };
});
