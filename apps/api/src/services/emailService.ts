import nodemailer from 'nodemailer';
import { db } from '../lib/db';

export type TransactionalEmailType =
  | 'order_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'password_reset'
  | 'review_request'
  | 'back_in_stock'
  | 'low_stock_alert'
  | 'weekly_seo_report'
  | 'backup_status';

type SiteBranding = { logo?: string; primaryColor?: string; siteName?: string };
type SmtpConfig = { host?: string; port?: number; user?: string; pass?: string; from?: string; secure?: boolean };

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const resolveSiteConfig = async (siteId?: string | null) => {
  if (!siteId) return { smtp: {}, branding: {} };
  const site = await db.sites.findUnique({ where: { id: siteId }, select: { config: true, name: true, domain: true } });
  const config = asRecord(site?.config);
  const smtpRaw = asRecord(config.smtp);
  const brandingRaw = asRecord(config.branding);
  const smtp: SmtpConfig = {
    host: typeof smtpRaw.host === 'string' ? smtpRaw.host : undefined,
    port: typeof smtpRaw.port === 'number' ? smtpRaw.port : 587,
    user: typeof smtpRaw.user === 'string' ? smtpRaw.user : undefined,
    pass: typeof smtpRaw.pass === 'string' ? smtpRaw.pass : undefined,
    from: typeof smtpRaw.from === 'string' ? smtpRaw.from : undefined,
    secure: Boolean(smtpRaw.secure)
  };
  const branding: SiteBranding = {
    logo: typeof brandingRaw.logo === 'string' ? brandingRaw.logo : undefined,
    primaryColor: typeof brandingRaw.primaryColor === 'string' ? brandingRaw.primaryColor : '#1f2937',
    siteName: typeof site?.name === 'string' ? site.name : undefined
  };
  return { smtp, branding };
};

const getTemplate = (
  type: TransactionalEmailType,
  payload: Record<string, unknown>,
  branding: SiteBranding
): { subject: string; html: string } => {
  const title = branding.siteName || 'Ecom System';
  const primaryColor = branding.primaryColor || '#1f2937';
  const wrap = (subject: string, body: string) => ({
    subject,
    html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2 style="color:${primaryColor}">${title}</h2>${body}</div>`
  });
  if (type === 'order_confirmation') {
    return wrap(`Order Confirmed #${String(payload.order_number || '')}`, `<p>Your order has been confirmed.</p><p>Total: ${String(payload.total || '')}</p>`);
  }
  if (type === 'order_shipped') return wrap('Your order has shipped', `<p>Your order is on the way.</p><p>Tracking: ${String(payload.tracking_link || 'TBD')}</p>`);
  if (type === 'order_delivered') return wrap('Order delivered', `<p>Your order has been delivered.</p><p>Please leave a review.</p>`);
  if (type === 'password_reset') return wrap('Password reset', `<p>Use this link to reset your password: ${String(payload.reset_link || '')}</p>`);
  if (type === 'review_request') return wrap('How was your order?', `<p>Please review your purchase.</p>`);
  if (type === 'back_in_stock') return wrap('Back in stock', `<p>${String(payload.product_name || 'A product')} is back in stock.</p>`);
  if (type === 'low_stock_alert') return wrap('Low stock alert', `<p>${String(payload.product_name || 'A product')} hit low stock threshold.</p>`);
  if (type === 'weekly_seo_report') return wrap('Weekly SEO report', `<p>${String(payload.summary || 'SEO report ready.')}</p>`);
  return wrap('Backup status', `<p>${String(payload.status || 'Backup status available')}</p>`);
};

export const sendTypedTransactionalEmail = async (input: {
  siteId?: string | null;
  to: string;
  type: TransactionalEmailType;
  payload?: Record<string, unknown>;
}) => {
  const payload = input.payload || {};
  const { smtp, branding } = await resolveSiteConfig(input.siteId);
  const template = getTemplate(input.type, payload, branding);
  const fromAddress = smtp.from || process.env.SMTP_FROM || 'no-reply@localhost';
  const transport =
    smtp.host && smtp.user && smtp.pass
      ? nodemailer.createTransport({
          host: smtp.host,
          port: Number(smtp.port || 587),
          secure: Boolean(smtp.secure),
          auth: { user: smtp.user, pass: smtp.pass }
        })
      : null;

  try {
    if (transport) {
      await transport.sendMail({ from: fromAddress, to: input.to, subject: template.subject, html: template.html });
    } else {
      console.log('[email:fallback]', { to: input.to, subject: template.subject });
    }
    await db.email_logs.create({
      data: {
        site_id: input.siteId || null,
        email_type: input.type,
        to_email: input.to,
        subject: template.subject,
        status: 'sent',
        payload: payload as any,
        sent_at: new Date()
      }
    });
    return true;
  } catch (error) {
    await db.email_logs.create({
      data: {
        site_id: input.siteId || null,
        email_type: input.type,
        to_email: input.to,
        subject: template.subject,
        status: 'failed',
        payload: payload as any,
        error_message: error instanceof Error ? error.message : 'Email send failed'
      }
    });
    return false;
  }
};

export const sendTransactionalEmail = async (to: string, subject: string, html: string) => {
  const ok = await sendTypedTransactionalEmail({
    to,
    type: 'backup_status',
    payload: { status: subject, body: html }
  });
  return ok;
};
