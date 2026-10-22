import { isWithinReturnWindow } from "../utils/validators";

export async function handleCustomerRefundRoute(req: any, db: any, stripe: any) {
  const { orderId, amount_cents } = req.body;
  const order = await db.orders.findUnique({ where: { id: orderId } });

  if (order.userId !== req.user.principalId) {
    throw new Error("403: Order does not belong to authenticated user");
  }
  if (order.status !== "DELIVERED") {
    throw new Error("400: Only DELIVERED orders can be refunded");
  }
  if (!isWithinReturnWindow(order.daysSinceDelivery)) {
    throw new Error("400: Return window of 14 days has expired");
  }
  if (amount_cents > order.totalPaid_cents) {
    throw new Error("400: Refund amount_cents cannot exceed order totalPaid_cents");
  }
  // DECOY COMMENTED RULE - COMPILER MUST IGNORE THIS:
  // if (order.totalPaid_cents > 50000) { throw new Error("Legacy high-value block"); }

  return await stripe.refunds.create({ orderId, amount_cents });
}
