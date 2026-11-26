// The names on the flat map's moving canvas. They are painted after the dots, so a moon's dot cannot cover a place's name.

export type FlatLabel = { text: string; x: number; y: number; align: CanvasTextAlign };

/** Paint these names with a dark edge, in the order given. An empty list changes nothing. */
export function paintFlatLabels(ctx: CanvasRenderingContext2D, labels: readonly FlatLabel[]): void {
  if (labels.length === 0) return;
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,.72)";
  ctx.fillStyle = "#fff";
  for (const label of labels) {
    ctx.textAlign = label.align;
    ctx.strokeText(label.text, label.x, label.y);
    ctx.fillText(label.text, label.x, label.y);
  }
  ctx.textAlign = "left";
}
