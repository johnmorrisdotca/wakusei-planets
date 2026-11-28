const GOLDEN = (Math.sqrt(5) - 1) / 2;

/** The moment of the smallest value of a function with one minimum in [low, high], to within `tolerance` ms. */
export function golden(f: (ms: number) => number, low: number, high: number, tolerance: number): number {
  let a = low;
  let b = high;
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = f(c);
  let fd = f(d);
  while (b - a > tolerance) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN * (b - a);
      fc = f(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN * (b - a);
      fd = f(d);
    }
  }
  return (a + b) / 2;
}
