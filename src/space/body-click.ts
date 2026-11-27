// A press on a body tells the page, and the page may take it. Pure aside from the event: the view asks, and does not go when the page said no.

/**
 * Tell the page a body was pressed (`wakusei-body-click`, bubbling and composed, and cancelable).
 * @returns True when the page called `preventDefault`: the view stays, and the page's own Go moves it.
 */
export function tellBodyClick(target: EventTarget, detail: unknown): boolean {
  const event = new CustomEvent("wakusei-body-click", { detail, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}
