import { Router, Request, Response } from 'express';
import { assertActiveSubscription, assertCreditLimit } from '../middleware/guard';

const router = Router();

router.post(
  '/subscriptions/credit',
  assertActiveSubscription,
  assertCreditLimit,
  async (req: Request, res: Response) => {
    const { subscriptionId, amount_cents } = req.body;
    return res.status(200).json({
      success: true,
      creditId: 'crd_' + Date.now(),
      subscriptionId,
      amount_cents,
    });
  }
);

export default router;
