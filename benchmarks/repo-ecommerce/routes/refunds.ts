import { Router, Request, Response } from 'express';
import { isWithinWindow, isValidAmount } from '../utils/validators';

const router = Router();

// Mock database lookup
async function fetchOrder(orderId: string) {
  return {
    orderId,
    userId: 'user_123',
    status: 'DELIVERED',
    daysSinceDelivery: 5,
    totalPaid_cents: 12000,
  };
}

router.post('/refunds', async (req: Request, res: Response) => {
  const { orderId, amount_cents, reason } = req.body;

  const order = await fetchOrder(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Precondition 1: Status must be DELIVERED
  if (order.status !== 'DELIVERED') {
    return res.status(400).json({ error: 'Order must be DELIVERED to issue refund' });
  }

  // Precondition 2: Must be within 14 days of delivery
  if (!isWithinWindow(order.daysSinceDelivery, 14)) {
    return res.status(400).json({ error: 'Refunds only allowed within 14 days of delivery' });
  }

  // Precondition 3: Amount cannot exceed total paid
  if (!isValidAmount(amount_cents, order.totalPaid_cents)) {
    return res.status(400).json({ error: 'Refund amount cannot exceed total paid' });
  }

  // DECOY TRAP: Commented-out rule that compiler MUST ignore!
  // if (order.isGift) {
  //   return res.status(400).json({ error: 'Gift orders cannot be refunded' });
  // }

  // Execute refund mutation
  return res.status(200).json({
    success: true,
    refundId: 'ref_' + Date.now(),
    orderId,
    amount_cents,
  });
});

export default router;
