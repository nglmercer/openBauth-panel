import nodemailer from 'nodemailer';
import { defaultLogger } from '../utils/logger';

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class NotificationService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const result = await this.transporter.sendMail({
        from: this.config.smtp.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      defaultLogger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: result.messageId,
      });

      return true;
    } catch (error) {
      defaultLogger.error('Failed to send email', error as Error, {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetLink = `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    return this.sendEmail({
      to: email,
      subject: 'Recuperación de Contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Recupera tu acceso</h1>
          <p>Hola,</p>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Restablecer Contraseña
            </a>
          </p>
          <p>Si no puedes hacer clic en el enlace, copia y pega esta URL en tu navegador:</p>
          <p style="word-break: break-all; color: #007bff;">${resetLink}</p>
          <p><strong>Este enlace expira en 1 hora.</strong></p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Si no solicitaste este cambio, puedes ignorar este correo.
          </p>
        </div>
      `,
      text: `Has solicitado restablecer tu contraseña. Visita este enlace: ${resetLink} (expira en 1 hora)`,
    });
  }

  async sendEmailVerification(email: string, token: string): Promise<boolean> {
    const verificationLink = `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    return this.sendEmail({
      to: email,
      subject: 'Verificación de Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Verifica tu email</h1>
          <p>Hola,</p>
          <p>Gracias por registrarte. Para completar tu registro, verifica tu dirección de email:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verificar Email
            </a>
          </p>
          <p>Si no puedes hacer clic en el enlace, copia y pega esta URL:</p>
          <p style="word-break: break-all; color: #28a745;">${verificationLink}</p>
          <p><strong>Este enlace expira en 24 horas.</strong></p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Si no te registraste, puedes ignorar este correo.
          </p>
        </div>
      `,
      text: `Gracias por registrarte. Verifica tu email visitando: ${verificationLink} (expira en 24 horas)`,
    });
  }

  async sendMFAEmail(email: string, code: string): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Código de Verificación',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Código de Verificación</h1>
          <p>Hola,</p>
          <p>Tu código de verificación es:</p>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <h2 style="font-size: 32px; letter-spacing: 4px; margin: 0; color: #333;">${code}</h2>
          </div>
          <p><strong>Este código expira en 5 minutos.</strong></p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Si no solicitaste este código, puedes ignorar este correo.
          </p>
        </div>
      `,
      text: `Tu código de verificación es: ${code} (expira en 5 minutos)`,
    });
  }

  async sendSecurityAlert(email: string, alertType: string, details: any): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject: 'Alerta de Seguridad',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>🚨 Alerta de Seguridad</h1>
          <p>Se ha detectado una actividad inusual en tu cuenta:</p>
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Tipo de alerta:</strong> ${alertType}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            ${details.ip ? `<p><strong>IP:</strong> ${details.ip}</p>` : ''}
            ${details.userAgent ? `<p><strong>Dispositivo:</strong> ${details.userAgent}</p>` : ''}
          </div>
          <p>Si no fuiste tú, te recomendamos:</p>
          <ul>
            <li>Cambiar tu contraseña inmediatamente</li>
            <li>Revisar tus sesiones activas</li>
            <li>Contactar soporte si es necesario</li>
          </ul>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Este es un correo automático de seguridad.
          </p>
        </div>
      `,
      text: `Alerta de seguridad: ${alertType} detectado en ${new Date().toLocaleString()}`,
    });
  }
}