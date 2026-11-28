/** A body picture the space view is holding or has let go. */
export type HeldPicture = { drawing: { dispose(): void } | undefined; look: string | null };

/**
 * Let the picture go. The look is cleared so the picture is loaded again the next time the body is wanted.
 * A look left set would make the next fill skip the body, and it would stay unpainted.
 */
export function releaseBodyPicture(slot: HeldPicture): void {
  slot.drawing?.dispose();
  slot.drawing = undefined;
  slot.look = null;
}

/**
 * Whether an off-screen body still holds its picture.
 * One that has never been on screen keeps it, so the opening view's bodies are painted.
 * One that has been on screen keeps it for `keepMs` after it leaves, then it is dropped and loaded again when it returns.
 */
export function pictureHeld(seenAt: number, now: number, keepMs: number): boolean {
  return seenAt === 0 || now - seenAt <= keepMs;
}
