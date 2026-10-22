import { Request, Response, NextFunction } from 'express';

export function assertActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const sub = req.body?.subscription;
  if (!sub || sub.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Subscription must be ACTIVE to apply invoice credit' });
  }
  next();
}

export function assertCreditLimit(req: Request, res: Response, next: NextFunction) {
  const amount_cents = req.body?.amount_cents;
  const maxInvoiceCents = req.body?.subscription?.lastInvoiceCents ?? 0;
  if (amount_cents > maxInvoiceCents) {
    return res.status(400).json({ error: 'Invoice credit cannot exceed last invoice total' });
  }
  next();
}
