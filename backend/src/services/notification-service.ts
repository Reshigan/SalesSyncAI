/**
 * Notification Service for SalesSync
 * Handles push notifications, SMS, email, and in-app notifications
 */

import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import webpush from 'web-push';

const prisma = new PrismaClient();

// Configure services
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Configure web push
webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@salessync.com'),
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export interface NotificationInput {
  type: 'info' | 'warning' | 'error' | 'success' | 'fraud_alert' | 'system' | 'campaign' | 'visit' | 'sale';
  recipientId: string;
  title: string;
  message: string;
  data?: any;
  channels?: NotificationChannel[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  scheduledFor?: Date;
  expiresAt?: Date;
}

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  channelResults: ChannelResult[];
  errors?: string[];
}

export interface ChannelResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  channels: NotificationChannel[];
  template: {
    title: string;
    message: string;
    emailSubject?: string;
    emailBody?: string;
    smsMessage?: string;
  };
  variables: string[];
}

/**
 * Send notification to user
 * @param input Notification input data
 * @returns Notification result
 */
export async function sendNotification(input: NotificationInput): Promise<NotificationResult> {
  try {
    // Get recipient details
    const recipient = await prisma.user.findUnique({
      where: { id: input.recipientId },
      include: {
        pushSubscriptions: true
      }
    });

    if (!recipient) {
      return {
        success: false,
        channelResults: [],
        errors: ['Recipient not found']
      };
    }

    // Determine channels to use
    const channels = input.channels || determineChannels(input.type, input.priority, recipient);

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        type: input.type,
        userId: input.recipientId,
        companyId: recipient.companyId,
        title: input.title,
        message: input.message,
        data: input.data || {},
        channels: channels,
        status: 'PENDING'
      }
    });

    // Send via each channel
    const channelResults: ChannelResult[] = [];

    for (const channel of channels) {
      try {
        const result = await sendViaChannel(channel, input, recipient);
        channelResults.push(result);
      } catch (error) {
        channelResults.push({
          channel,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Update notification status
    const overallSuccess = channelResults.some(r => r.success);
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: overallSuccess ? 'SENT' : 'FAILED',
        sentAt: overallSuccess ? new Date() : null
      }
    });

    return {
      success: overallSuccess,
      notificationId: notification.id,
      channelResults,
      errors: channelResults.filter(r => !r.success).map(r => r.error).filter(Boolean) as string[]
    };

  } catch (error) {
    console.error('Notification sending error:', error);
    return {
      success: false,
      channelResults: [],
      errors: [error instanceof Error ? error.message : "Unknown error"]
    };
  }
}

/**
 * Send notification via specific channel
 * @param channel Notification channel
 * @param input Notification input
 * @param recipient Recipient user data
 * @returns Channel result
 */
async function sendViaChannel(
  channel: NotificationChannel,
  input: NotificationInput,
  recipient: any
): Promise<ChannelResult> {
  switch (channel) {
    case 'push':
      return await sendPushNotification(input, recipient);
    case 'email':
      return await sendEmailNotification(input, recipient);
    case 'sms':
      return await sendSMSNotification(input, recipient);
    case 'in_app':
      return await sendInAppNotification(input, recipient);
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }
}

/**
 * Send push notification
 * @param input Notification input
 * @param recipient Recipient data
 * @returns Channel result
 */
async function sendPushNotification(
  input: NotificationInput,
  recipient: any
): Promise<ChannelResult> {
  try {
    if (!recipient.pushSubscriptions || recipient.pushSubscriptions.length === 0) {
      return {
        channel: 'push',
        success: false,
        error: 'No push subscriptions found'
      };
    }

    const payload = JSON.stringify({
      title: input.title,
      body: input.message,
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      data: input.data || {},
      actions: generateNotificationActions(input.type)
    });

    const results = await Promise.allSettled(
      recipient.pushSubscriptions.map((subscription: any) =>
        webpush.sendNotification(JSON.parse(subscription.subscription), payload)
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;

    return {
      channel: 'push',
      success: successCount > 0,
      messageId: `push_${Date.now()}`,
      error: successCount === 0 ? 'All push notifications failed' : undefined
    };

  } catch (error) {
    return {
      channel: 'push',
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Send email notification
 * @param input Notification input
 * @param recipient Recipient data
 * @returns Channel result
 */
async function sendEmailNotification(
  input: NotificationInput,
  recipient: any
): Promise<ChannelResult> {
  try {
    if (!recipient.email) {
      return {
        channel: 'email',
        success: false,
        error: 'No email address found'
      };
    }

    const emailTemplate = generateEmailTemplate(input, recipient);

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@salessync.com',
      to: recipient.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };

    const result = await emailTransporter.sendMail(mailOptions);

    return {
      channel: 'email',
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    return {
      channel: 'email',
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Send SMS notification
 * @param input Notification input
 * @param recipient Recipient data
 * @returns Channel result
 */
async function sendSMSNotification(
  input: NotificationInput,
  recipient: any
): Promise<ChannelResult> {
  try {
    if (!twilioClient) {
      return {
        channel: 'sms',
        success: false,
        error: 'SMS service not configured'
      };
    }

    if (!recipient.phone) {
      return {
        channel: 'sms',
        success: false,
        error: 'No phone number found'
      };
    }

    const smsMessage = generateSMSMessage(input);

    const message = await twilioClient.messages.create({
      body: smsMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: recipient.phone
    });

    return {
      channel: 'sms',
      success: true,
      messageId: message.sid
    };

  } catch (error) {
    return {
      channel: 'sms',
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Send in-app notification
 * @param input Notification input
 * @param recipient Recipient data
 * @returns Channel result
 */
async function sendInAppNotification(
  input: NotificationInput,
  recipient: any
): Promise<ChannelResult> {
  try {
    // In-app notifications are stored in database and retrieved by client
    await prisma.inAppNotification.create({
      data: {
        userId: recipient.id,
        title: input.title,
        message: input.message,
        data: input.data || {},
        type: input.type || 'INFO',
        isRead: false
      }
    });

    return {
      channel: 'in_app',
      success: true,
      messageId: `in_app_${Date.now()}`
    };

  } catch (error) {
    return {
      channel: 'in_app',
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Determine notification channels based on type and priority
 * @param type Notification type
 * @param priority Notification priority
 * @param recipient Recipient data
 * @returns Array of channels
 */
function determineChannels(
  type: string,
  priority: string = 'MEDIUM',
  recipient: any
): NotificationChannel[] {
  const settings = recipient.notificationSettings || {};
  const channels: NotificationChannel[] = ['in_app']; // Always include in-app

  // Add channels based on type and priority
  switch (priority) {
    case 'URGENT':
      if (settings.smsEnabled !== false) channels.push('sms');
      if (settings.emailEnabled !== false) channels.push('email');
      if (settings.pushEnabled !== false) channels.push('push');
      break;
    case 'HIGH':
      if (settings.emailEnabled !== false) channels.push('email');
      if (settings.pushEnabled !== false) channels.push('push');
      break;
    case 'MEDIUM':
      if (settings.pushEnabled !== false) channels.push('push');
      break;
    case 'LOW':
      // Only in-app for low priority
      break;
  }

  // Type-specific channel preferences
  switch (type) {
    case 'fraud_alert':
      if (!channels.includes('email')) channels.push('email');
      if (!channels.includes('sms')) channels.push('sms');
      break;
    case 'system':
      if (!channels.includes('email')) channels.push('email');
      break;
    case 'visit':
    case 'sale':
      // Usually just push and in-app
      break;
  }

  return channels;
}

/**
 * Generate email template
 * @param input Notification input
 * @param recipient Recipient data
 * @returns Email template
 */
function generateEmailTemplate(input: NotificationInput, recipient: any): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `SalesSync: ${input.title}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1E3A8A; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 10px 20px; background: #FB923C; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SalesSync</h1>
          <p>Sync Your Success in the Field</p>
        </div>
        <div class="content">
          <h2>${input.title}</h2>
          <p>Hello ${recipient.firstName || 'User'},</p>
          <p>${input.message}</p>
          ${generateEmailActions(input.type, input.data)}
        </div>
        <div class="footer">
          <p>This is an automated message from SalesSync. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} SalesSync. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    SalesSync Notification
    
    ${input.title}
    
    Hello ${recipient.firstName || 'User'},
    
    ${input.message}
    
    ---
    This is an automated message from SalesSync.
    © ${new Date().getFullYear()} SalesSync. All rights reserved.
  `;

  return { subject, html, text };
}

/**
 * Generate SMS message
 * @param input Notification input
 * @returns SMS message text
 */
function generateSMSMessage(input: NotificationInput): string {
  const maxLength = 160;
  const prefix = 'SalesSync: ';
  const availableLength = maxLength - prefix.length;
  
  let message = input.message;
  if (message.length > availableLength) {
    message = message.substring(0, availableLength - 3) + '...';
  }
  
  return prefix + message;
}

/**
 * Generate notification actions for push notifications
 * @param type Notification type
 * @returns Array of actions
 */
function generateNotificationActions(type: string): any[] {
  switch (type) {
    case 'visit':
      return [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    case 'fraud_alert':
      return [
        { action: 'investigate', title: 'Investigate' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
    default:
      return [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
  }
}

/**
 * Generate email actions based on notification type
 * @param type Notification type
 * @param data Notification data
 * @returns HTML for email actions
 */
function generateEmailActions(type: string, data: any): string {
  const baseUrl = process.env.FRONTEND_URL || 'https://app.salessync.com';
  
  switch (type) {
    case 'visit':
      return `<p><a href="${baseUrl}/visits/${data?.visitId}" class="button">View Visit Details</a></p>`;
    case 'fraud_alert':
      return `<p><a href="${baseUrl}/fraud/investigate/${data?.agentId}" class="button">Investigate Alert</a></p>`;
    case 'campaign':
      return `<p><a href="${baseUrl}/campaigns/${data?.campaignId}" class="button">View Campaign</a></p>`;
    default:
      return `<p><a href="${baseUrl}/dashboard" class="button">Go to Dashboard</a></p>`;
  }
}

/**
 * Send bulk notifications
 * @param inputs Array of notification inputs
 * @returns Array of notification results
 */
export async function sendBulkNotifications(inputs: NotificationInput[]): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];
  
  // Process in batches to avoid overwhelming services
  const batchSize = 10;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(input => sendNotification(input))
    );
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Send notification using template
 * @param templateId Template ID
 * @param recipientId Recipient ID
 * @param variables Template variables
 * @returns Notification result
 */
export async function sendTemplatedNotification(
  templateId: string,
  recipientId: string,
  variables: Record<string, any> = {}
): Promise<NotificationResult> {
  try {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return {
        success: false,
        channelResults: [],
        errors: ['Template not found']
      };
    }

    // Replace variables in template content
    const title = template.subject ? replaceVariables(template.subject, variables) : 'Notification';
    const message = replaceVariables(template.content, variables);

    return await sendNotification({
      type: template.type as any,
      recipientId,
      title,
      message,
      channels: ['email', 'in_app'], // Default channels
      data: variables
    });

  } catch (error) {
    return {
      success: false,
      channelResults: [],
      errors: [error instanceof Error ? error.message : "Unknown error"]
    };
  }
}

/**
 * Replace variables in template string
 * @param template Template string
 * @param variables Variables object
 * @returns Processed string
 */
function replaceVariables(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

/**
 * Get user notifications
 * @param userId User ID
 * @param options Query options
 * @returns Array of notifications
 */
export async function getUserNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {}
): Promise<any[]> {
  const { limit = 50, offset = 0, unreadOnly = false, type } = options;

  const where: any = { userId };
  if (unreadOnly) where.read = false;
  if (type) where.type = type;

  return await prisma.inAppNotification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset
  });
}

/**
 * Mark notification as read
 * @param notificationId Notification ID
 * @param userId User ID
 * @returns Success status
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  try {
    await prisma.inAppNotification.update({
      where: {
        id: notificationId,
        userId
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
    return true;
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for user
 * @param userId User ID
 * @returns Success status
 */
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  try {
    await prisma.inAppNotification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
    return true;
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return false;
  }
}

/**
 * Subscribe user to push notifications
 * @param userId User ID
 * @param subscription Push subscription object
 * @returns Success status
 */
export async function subscribeToPushNotifications(
  userId: string,
  subscription: any
): Promise<boolean> {
  try {
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        isActive: true
      }
    });
    return true;
  } catch (error) {
    console.error('Push subscription error:', error);
    return false;
  }
}

/**
 * Unsubscribe user from push notifications
 * @param userId User ID
 * @param endpoint Subscription endpoint
 * @returns Success status
 */
export async function unsubscribeFromPushNotifications(
  userId: string,
  endpoint: string
): Promise<boolean> {
  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint: endpoint
      }
    });
    return true;
  } catch (error) {
    console.error('Push unsubscription error:', error);
    return false;
  }
}

export default {
  sendNotification,
  sendBulkNotifications,
  sendTemplatedNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications
};