import type { SessionEndReason } from '../../api/client';

let pending: SessionEndReason | null = null;

/** Remembers why a signed-in user was sent back to the login page. */
export function noteSessionEnded(reason: SessionEndReason): void {
  pending = reason;
}

/** Returns the reason once (for one message on the login page), then forgets it. */
export function takeSessionEndNotice(): SessionEndReason | null {
  const reason = pending;
  pending = null;
  return reason;
}
