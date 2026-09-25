export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}