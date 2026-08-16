export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return `${odds}`;
}

export function americanToDecimal(americanOdds: number): number {
  return americanOdds > 0 ? americanOdds / 100 + 1 : 1 - 100 / americanOdds;
}

export function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2) return Math.round((decimalOdds - 1) * 100);
  return Math.round(-100 / (decimalOdds - 1));
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}
