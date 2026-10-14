/**
 * Notification dispatcher for human-in-the-loop (HITL) approval requests.
 * Supports Slack Incoming Webhooks and generic JSON webhooks.
 */

export async function dispatchApprovalNotification(params: {
  approvalId: string;
  agentName: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  reason: string;
  dashboardUrl?: string;
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.APPROVAL_WEBHOOK_URL;
  if (!webhookUrl) {
    return false;
  }

  const baseDashboardUrl = params.dashboardUrl || process.env.DASHBOARD_URL || 'http://localhost:3000';
  const approvalLink = `${baseDashboardUrl}/agents/approvals`;

  const payload = {
    text: `🚨 [AgentGate] High-Risk Action Requires Authorization: ${params.agentName} wants to run ${params.toolName}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 High-Risk Action Requires Authorization',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Agent:*\n${params.agentName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Tool:*\n\`${params.toolName}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reason:*\n${params.reason}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Arguments:*\n\`\`\`json\n${JSON.stringify(params.toolArgs, null, 2)}\n\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Review in Dashboard',
              emoji: true,
            },
            url: approvalLink,
            style: 'primary',
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to dispatch webhook notification:', err);
    return false;
  }
}
