export function isWithinWindow(daysSinceDelivery: number, maxDays = 14): boolean {
  return daysSinceDelivery <= maxDays;
}

export function isValidAmount(amountCents: number, maxTotalCents: number): boolean {
  return amountCents <= maxTotalCents;
}
