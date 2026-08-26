import { prisma } from '../../lib/prisma';

export interface SendNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, unknown>;
}

export async function sendInAppNotification(input: SendNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
      data: input.data as object | undefined,
    },
  });
}

export async function notifyPlatformAdmins(title: string, message: string, type: string) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'PLATFORM_STAFF'] }, isActive: true },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      sendInAppNotification({ userId: admin.id, title, message, type })
    )
  );
}

export async function logOutboundMessage(
  channel: string,
  recipient: string,
  subject: string,
  body: string
) {
  // Records intent; actual provider integration hooks in here later
  console.log(`[Notification:${channel}] to=${recipient} subject=${subject}`);
  return { channel, recipient, subject, body, status: 'queued' as const };
}

export async function sendMultiChannel(
  channels: string[],
  recipient: { userId?: string; email?: string; phone?: string },
  title: string,
  message: string
) {
  const results = [];
  if (recipient.userId && channels.includes('push')) {
    results.push(await sendInAppNotification({ userId: recipient.userId, title, message, type: 'automation' }));
  }
  if (recipient.email && channels.includes('email')) {
    results.push(await logOutboundMessage('email', recipient.email, title, message));
  }
  if (recipient.phone && channels.includes('sms')) {
    results.push(await logOutboundMessage('sms', recipient.phone, title, message));
  }
  if (recipient.phone && channels.includes('whatsapp')) {
    results.push(await logOutboundMessage('whatsapp', recipient.phone, title, message));
  }
  return results;
}
