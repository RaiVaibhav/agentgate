export function isWithinReturnWindow(daysSinceDelivery: number): boolean {
  return daysSinceDelivery <= 14;
}
