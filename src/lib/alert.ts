/**
 * Send alerts to Slack when critical services fail
 */
export async function sendAlert(service: string, error: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('[Alert] SLACK_WEBHOOK_URL not configured, skipping alert');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: `[ALERT] ${service} failed: ${error}` 
      }),
    });
  } catch (err) {
    console.error('[Alert] Failed to send Slack alert:', err);
    // Don't throw - alerting failures shouldn't break the app
  }
}

