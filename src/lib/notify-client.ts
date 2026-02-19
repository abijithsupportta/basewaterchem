/**
 * Send a notification email via the /api/notify endpoint.
 * This is a fire-and-forget helper — errors are logged but don't block the UI.
 */
export async function notifyCustomer(
  type: 'service_scheduled' | 'service_completed',
  params: Record<string, any>
) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...params }),
    });
  } catch (error) {
    console.error('[Notify] Failed to send notification:', error);
  }
}
