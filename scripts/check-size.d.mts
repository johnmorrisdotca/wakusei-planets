export const MARGIN: number;
export const SLACK: number;
export const MIN_GROWTH: number;
export function overBudget(now: Record<string, number>, baseline: Record<string, number>, minifiedNow?: Record<string, number>, minifiedBaseline?: Record<string, number>): string[];
