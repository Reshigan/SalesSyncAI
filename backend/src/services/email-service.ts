/**
 * Advanced Email Service for SalesSync
 * Handles transactional emails, report delivery, and notifications
 */

import nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  template?: string;
  templateData?: any;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  priority?: 'high' | 'normal' | 'low';
  replyTo?: string;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  cid?: string; // For inline images
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: {
    name: string;
    email: string;
  };
  replyTo?: string;
  templates: {
    path: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
  private config: EmailConfig;
  private templates: Map<string, EmailTemplate> = new Map();

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
    this.loadTemplates();
  }

  /**
   * Initialize SMTP transporter
   */
  private initializeTransporter(): void {
    this.transporter = createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: {
        user: this.config.smtp.auth.user,
        pass: this.config.smtp.auth.pass
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10
    });

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Email service connection error:', error);
      } else {
        console.log('Email service ready');
      }
    });
  }

  /**
   * Load email templates
   */
  private async loadTemplates(): Promise<void> {
    try {
      const templatesPath = this.config.templates.path;
      
      if (!fs.existsSync(templatesPath)) {
        console.warn('Email templates directory not found:', templatesPath);
        return;
      }

      const templateFiles = fs.readdirSync(templatesPath);
      
      for (const file of templateFiles) {
        if (file.endsWith('.hbs') || file.endsWith('.handlebars')) {
          const templateName = path.basename(file, path.extname(file));
          const templatePath = path.join(templatesPath, file);
          const templateContent = fs.readFileSync(templatePath, 'utf8');
          
          // Parse template metadata (subject, etc.) from comments
          const subjectMatch = templateContent.match(/{{!-- subject: (.*?) --}}/);
          const subject = subjectMatch ? subjectMatch[1] : `SalesSync - ${templateName}`;
          
          this.templates.set(templateName, {
            name: templateName,
            subject,
            html: templateContent
          });
        }
      }

      console.log(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      let html = options.html;
      let subject = options.subject;

      // Use template if specified
      if (options.template) {
        const template = this.templates.get(options.template);
        if (template) {
          const compiledTemplate = handlebars.compile(template.html);
          html = compiledTemplate(options.templateData || {});
          
          // Use template subject if not provided
          if (!options.subject && template.subject) {
            const compiledSubject = handlebars.compile(template.subject);
            subject = compiledSubject(options.templateData || {});
          }
        } else {
          console.warn(`Email template '${options.template}' not found`);
        }
      }

      const mailOptions = {
        from: `${this.config.from.name} <${this.config.from.email}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject,
        html,
        text: options.text,
        attachments: options.attachments,
        priority: options.priority || 'normal',
        replyTo: options.replyTo || this.config.replyTo
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', {
        messageId: result.messageId,
        to: options.to,
        subject
      });

      return true;

    } catch (error) {
      console.error('Email sending error:', error);
      return false;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userEmail: string, userData: any): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      template: 'welcome',
      templateData: {
        userName: userData.name,
        companyName: userData.companyName,
        loginUrl: userData.loginUrl,
        supportEmail: this.config.from.email
      }
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail: string, resetData: any): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      template: 'password-reset',
      templateData: {
        userName: resetData.name,
        resetUrl: resetData.resetUrl,
        expiryTime: resetData.expiryTime
      },
      priority: 'high'
    });
  }

  /**
   * Send analytics report email
   */
  async sendAnalyticsReport(
    recipients: string | string[],
    reportData: any,
    format: string,
    reportType: string,
    attachment?: Buffer
  ): Promise<boolean> {
    const attachments: EmailAttachment[] = [];

    if (attachment) {
      const fileName = `${reportType}-report-${new Date().toISOString().split('T')[0]}.${format}`;
      attachments.push({
        filename: fileName,
        content: attachment,
        contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    }

    return this.sendEmail({
      to: recipients,
      template: 'analytics-report',
      templateData: {
        reportType: reportType.charAt(0).toUpperCase() + reportType.slice(1),
        generatedDate: new Date().toLocaleDateString(),
        summary: this.generateReportSummary(reportData),
        format: format.toUpperCase()
      },
      attachments
    });
  }

  /**
   * Send performance alert email
   */
  async sendPerformanceAlert(
    recipients: string | string[],
    alertData: any
  ): Promise<boolean> {
    return this.sendEmail({
      to: recipients,
      template: 'performance-alert',
      templateData: {
        alertType: alertData.type,
        severity: alertData.severity,
        message: alertData.message,
        affectedEntities: alertData.affectedEntities,
        timestamp: new Date().toLocaleString(),
        actionRequired: alertData.actionRequired
      },
      priority: alertData.severity === 'high' ? 'high' : 'normal'
    });
  }

  /**
   * Send fraud alert email
   */
  async sendFraudAlert(
    recipients: string | string[],
    fraudData: any
  ): Promise<boolean> {
    return this.sendEmail({
      to: recipients,
      template: 'fraud-alert',
      templateData: {
        agentName: fraudData.agentName,
        fraudType: fraudData.fraudType,
        riskScore: fraudData.riskScore,
        evidence: fraudData.evidence,
        timestamp: new Date().toLocaleString(),
        investigationId: fraudData.investigationId
      },
      priority: 'high'
    });
  }

  /**
   * Send system notification email
   */
  async sendSystemNotification(
    recipients: string | string[],
    notificationData: any
  ): Promise<boolean> {
    return this.sendEmail({
      to: recipients,
      template: 'system-notification',
      templateData: {
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        timestamp: new Date().toLocaleString(),
        actionUrl: notificationData.actionUrl
      }
    });
  }

  /**
   * Send campaign notification email
   */
  async sendCampaignNotification(
    recipients: string | string[],
    campaignData: any
  ): Promise<boolean> {
    return this.sendEmail({
      to: recipients,
      template: 'campaign-notification',
      templateData: {
        campaignName: campaignData.name,
        campaignType: campaignData.type,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        description: campaignData.description,
        materials: campaignData.materials,
        targets: campaignData.targets
      }
    });
  }

  /**
   * Send bulk email to multiple recipients
   */
  async sendBulkEmail(
    recipients: string[],
    emailOptions: Omit<EmailOptions, 'to'>
  ): Promise<{ sent: number; failed: number; errors: any[] }> {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Send emails in batches to avoid overwhelming the SMTP server
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const promises = batch.map(async (recipient) => {
        try {
          const success = await this.sendEmail({
            ...emailOptions,
            to: recipient
          });
          
          if (success) {
            results.sent++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            recipient,
            error: error.message
          });
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Send scheduled report email
   */
  async sendScheduledReport(
    reportConfig: any,
    reportData: any,
    attachment: Buffer
  ): Promise<boolean> {
    return this.sendEmail({
      to: reportConfig.recipients,
      template: 'scheduled-report',
      templateData: {
        reportName: reportConfig.name,
        schedule: reportConfig.schedule,
        generatedDate: new Date().toLocaleDateString(),
        summary: this.generateReportSummary(reportData)
      },
      attachments: [{
        filename: `${reportConfig.name}-${new Date().toISOString().split('T')[0]}.${reportConfig.format}`,
        content: attachment,
        contentType: reportConfig.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    });
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(): Promise<boolean> {
    try {
      await this.transporter.verify();
      
      // Send test email
      const testResult = await this.sendEmail({
        to: this.config.from.email,
        subject: 'SalesSync Email Service Test',
        html: '<h1>Email Service Test</h1><p>This is a test email to verify the email service configuration.</p>',
        text: 'Email Service Test - This is a test email to verify the email service configuration.'
      });

      return testResult;
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return false;
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStatistics(): Promise<any> {
    // In production, this would query a database for email statistics
    return {
      totalSent: 0,
      totalFailed: 0,
      recentActivity: [],
      templates: Array.from(this.templates.keys())
    };
  }

  /**
   * Helper method to generate report summary
   */
  private generateReportSummary(reportData: any): string {
    const summary = [];
    
    if (reportData.sales) {
      summary.push(`Total Revenue: ${this.formatCurrency(reportData.sales.totalRevenue || 0)}`);
      summary.push(`Total Transactions: ${(reportData.sales.totalTransactions || 0).toLocaleString()}`);
    }
    
    if (reportData.visits) {
      summary.push(`Total Visits: ${(reportData.visits.totalVisits || 0).toLocaleString()}`);
      summary.push(`Success Rate: ${(reportData.visits.successRate || 0).toFixed(1)}%`);
    }
    
    if (reportData.performance) {
      summary.push(`Active Agents: ${(reportData.performance.agentPerformance?.length || 0).toLocaleString()}`);
    }

    return summary.join(' | ');
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  /**
   * Close email service
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
    }
  }
}

// Default email configuration
const defaultEmailConfig: EmailConfig = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'SalesSync',
    email: process.env.EMAIL_FROM_ADDRESS || 'noreply@salessync.com'
  },
  replyTo: process.env.EMAIL_REPLY_TO,
  templates: {
    path: path.join(__dirname, '../templates/email')
  }
};

// Create default email service instance
export const emailService = new EmailService(defaultEmailConfig);

// Export individual functions for convenience
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  return emailService.sendEmail(options);
}

export async function sendWelcomeEmail(userEmail: string, userData: any): Promise<boolean> {
  return emailService.sendWelcomeEmail(userEmail, userData);
}

export async function sendPasswordResetEmail(userEmail: string, resetData: any): Promise<boolean> {
  return emailService.sendPasswordResetEmail(userEmail, resetData);
}

export async function sendAnalyticsReport(
  recipients: string | string[],
  reportData: any,
  format: string,
  reportType: string,
  attachment?: Buffer
): Promise<boolean> {
  return emailService.sendAnalyticsReport(recipients, reportData, format, reportType, attachment);
}

export async function sendPerformanceAlert(
  recipients: string | string[],
  alertData: any
): Promise<boolean> {
  return emailService.sendPerformanceAlert(recipients, alertData);
}

export async function sendFraudAlert(
  recipients: string | string[],
  fraudData: any
): Promise<boolean> {
  return emailService.sendFraudAlert(recipients, fraudData);
}

export default EmailService;