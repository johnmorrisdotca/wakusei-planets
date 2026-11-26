// A line portrait is vector, so it zooms as far as a body's line drawing. A shaded portrait is measured from its bodies.

/** The zoom range of a line portrait: the same ceiling as `<wakusei-body look="line">`. */
export const LINE_PORTRAIT_LIMITS = { zoomMin: 0.1, zoomMax: 50 } as const;

/** The line portrait's own range, or `null` when the look is shaded and the bodies decide. */
export const linePortraitLimits = (look: string): typeof LINE_PORTRAIT_LIMITS | null => (look === "line" ? LINE_PORTRAIT_LIMITS : null);
