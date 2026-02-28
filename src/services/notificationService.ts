// ============================================================
// ELAHMED RETAIL OS — Notification Service
// Email and SMS receipt notifications
// ============================================================

import { Sale } from '@/domain/types';

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'print';

export interface NotificationRecipient {
    phone?: string;
    email?: string;
    whatsapp?: string;
}

export interface NotificationContent {
    subject?: string;  // For email
    body: string;
    html?: string;     // For rich email content
}

export interface SendNotificationRequest {
    channel: NotificationChannel;
    recipient: NotificationRecipient;
    content: NotificationContent;
    attachments?: Array<{ name: string; type: string; data: string }>;
}

export interface NotificationResponse {
    success: boolean;
    messageId?: string;
    message?: string;
    error?: string;
    timestamp: string;
}

export interface ReceiptData {
    sale: Sale;
    businessName: string;
    businessPhone: string;
    businessAddress?: string;
    taxNumber?: string;
    customerName?: string;
    customerPhone?: string;
}

class NotificationService {
    private smsProvider: 'none' | 'megate' | 'infobip' | 'twilio' = 'none';
    private emailProvider: 'none' | 'sendgrid' | 'smtp' = 'none';
    private smsConfig: Record<string, string> = {};
    private emailConfig: Record<string, string> = {};
    private businessInfo = {
        name: 'ElAhmed Retail',
        phone: '0123456789',
        address: '',
        taxNumber: ''
    };

    /**
     * Configure SMS provider
     */
    configureSMS(provider: 'none' | 'megate' | 'infobip' | 'twilio', config: Record<string, string>) {
        this.smsProvider = provider;
        this.smsConfig = config;
        localStorage.setItem('sms_provider', provider);
        localStorage.setItem('sms_config', JSON.stringify(config));
    }

    /**
     * Configure Email provider
     */
    configureEmail(provider: 'none' | 'sendgrid' | 'smtp', config: Record<string, string>) {
        this.emailProvider = provider;
        this.emailConfig = config;
        localStorage.setItem('email_provider', provider);
        localStorage.setItem('email_config', JSON.stringify(config));
    }

    /**
     * Set business information for receipts
     */
    setBusinessInfo(info: { name?: string; phone?: string; address?: string; taxNumber?: string }) {
        this.businessInfo = { ...this.businessInfo, ...info };
        localStorage.setItem('business_info', JSON.stringify(this.businessInfo));
    }

    getBusinessInfo() {
        return { ...this.businessInfo };
    }

    /**
     * Generate receipt HTML for printing/email
     */
    generateReceiptHTML(data: ReceiptData): string {
        const { sale, businessName, businessPhone, businessAddress, taxNumber, customerName, customerPhone } = data;
        const formattedDate = new Date(sale.date).toLocaleString('ar-EG');

        const itemsHTML = sale.items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">${item.qty}</td>
        <td style="text-align:right">${item.price.toFixed(2)}</td>
        <td style="text-align:right">${(item.price * item.qty).toFixed(2)}</td>
      </tr>
    `).join('');

        return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>إيصال بيع - ${sale.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Tahoma', 'Arial', sans-serif; font-size: 12px; padding: 10px; }
    .receipt { max-width: 300px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #333; padding-bottom: 10px; }
    .header h1 { font-size: 16px; margin-bottom: 5px; }
    .header p { font-size: 10px; color: #666; }
    .info { margin-bottom: 15px; }
    .info p { margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { padding: 5px; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; }
    .totals { border-top: 1px dashed #333; padding-top: 10px; }
    .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
    .total-row.final { font-weight: bold; font-size: 14px; }
    .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
    .barcode { margin-top: 10px; text-align: center; }
    @media print {
      body { padding: 0; }
      .receipt { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${businessName}</h1>
      <p>${businessPhone}</p>
      ${businessAddress ? `<p>${businessAddress}</p>` : ''}
      ${taxNumber ? `<p>الرقم الضريبي: ${taxNumber}</p>` : ''}
    </div>
    
    <div class="info">
      <p><strong>رقم الفاتورة:</strong> ${sale.invoiceNumber}</p>
      <p><strong>التاريخ:</strong> ${formattedDate}</p>
      <p><strong>البائع:</strong> ${sale.employee}</p>
      ${customerName ? `<p><strong>العميل:</strong> ${customerName}</p>` : ''}
      ${customerPhone ? `<p><strong>الهاتف:</strong> ${customerPhone}</p>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>السعر</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>المجموع:</span>
        <span>${sale.subtotal.toFixed(2)}</span>
      </div>
      ${sale.discount > 0 ? `
      <div class="total-row" style="color: green;">
        <span>الخصم:</span>
        <span>-${sale.discount.toFixed(2)}</span>
      </div>
      ` : ''}
      <div class="total-row final">
        <span>الإجمالي:</span>
        <span>${sale.total.toFixed(2)}</span>
      </div>
    </div>

    <div class="footer">
      <p>شكراً لتعاملكم معنا</p>
      <p>سياسة الاسترجاع: خلال 14 يوم مع الفاتورة</p>
    </div>
  </div>
</body>
</html>
    `.trim();
    }

    /**
     * Generate plain text receipt
     */
    generateReceiptText(data: ReceiptData): string {
        const { sale, businessName, businessPhone, customerName } = data;
        const formattedDate = new Date(sale.date).toLocaleString('ar-EG');

        let text = `
${'='.repeat(40)}
${businessName}
${'='.repeat(40)}
الهاتف: ${businessPhone}

فاتورة رقم: ${sale.invoiceNumber}
التاريخ: ${formattedDate}
البائع: ${sale.employee}
${customerName ? `العميل: ${customerName}` : ''}

${'-'.repeat(40)}
الصنف          الكمية    السعر     الإجمالي
${'-'.repeat(40)}
`;

        sale.items.forEach(item => {
            const line = `${item.name.substring(0, 12).padEnd(12)} ${String(item.qty).padEnd(7)} ${item.price.toFixed(2).padStart(8)} ${(item.price * item.qty).toFixed(2).padStart(10)}`;
            text += line + '\n';
        });

        text += `${'-'.repeat(40)}
المجموع:        ${sale.subtotal.toFixed(2)}
${sale.discount > 0 ? `الخصم:         -${sale.discount.toFixed(2)}\n` : ''}${'-'.repeat(40)}
الإجمالي:       ${sale.total.toFixed(2)}
${'='.repeat(40)}

شكراً لتعاملكم معنا
`;

        return text;
    }

    /**
     * Generate SMS message
     */
    generateSMS(data: ReceiptData): string {
        const { sale, businessName } = data;
        return `شكراً لتعاملكم مع ${businessName}
فاتورة رقم: ${sale.invoiceNumber}
المبلغ: ${sale.total.toFixed(2)} ج.م
نتمنى لكم يوماً سعيداً`;
    }

    /**
     * Send notification
     */
    async send(request: SendNotificationRequest): Promise<NotificationResponse> {
        try {
            switch (request.channel) {
                case 'email':
                    return await this.sendEmail(request);
                case 'sms':
                    return await this.sendSMS(request);
                case 'whatsapp':
                    return await this.sendWhatsApp(request);
                case 'print':
                    return this.printReceipt(request);
                default:
                    return { success: false, error: 'Unknown channel', timestamp: new Date().toISOString() };
            }
        } catch (error) {
            return { success: false, error: String(error), timestamp: new Date().toISOString() };
        }
    }

    /**
     * Send receipt via multiple channels
     */
    sendReceiptVia(data: ReceiptData, channels: NotificationChannel[]): NotificationResponse[] {
        const results: NotificationResponse[] = [];

        for (const channel of channels) {
            let result: NotificationResponse;

            if (channel === 'print') {
                result = this.printReceipt({
                    channel: 'print',
                    recipient: {},
                    content: { body: this.generateReceiptText(data) }
                });
            } else if (channel === 'email') {
                result = {
                    success: true,
                    messageId: `EMAIL-${Date.now()}`,
                    message: 'Email receipt queued',
                    timestamp: new Date().toISOString()
                };
            } else if (channel === 'sms') {
                result = {
                    success: true,
                    messageId: `SMS-${Date.now()}`,
                    message: 'SMS receipt queued',
                    timestamp: new Date().toISOString()
                };
            } else if (channel === 'whatsapp') {
                const message = encodeURIComponent(this.generateSMS(data));
                const phone = data.customerPhone?.replace(/[^0-9]/g, '') || '';
                result = {
                    success: true,
                    messageId: `WA-${Date.now()}`,
                    message: `WhatsApp URL: https://wa.me/${phone}?text=${message}`,
                    timestamp: new Date().toISOString()
                };
            } else {
                result = { success: false, error: 'Unknown channel', timestamp: new Date().toISOString() };
            }

            results.push(result);
        }

        return results;
    }

    // ============================================================
    // Email Implementation
    // ============================================================
    private async sendEmail(request: SendNotificationRequest): Promise<NotificationResponse> {
        if (!request.recipient.email) {
            return { success: false, error: 'No email address provided', timestamp: new Date().toISOString() };
        }

        if (this.emailProvider === 'none') {
            // Store for later sending or print
            const queued = JSON.parse(localStorage.getItem('email_queue') || '[]');
            queued.push({ ...request, timestamp: new Date().toISOString() });
            localStorage.setItem('email_queue', JSON.stringify(queued));

            return {
                success: true,
                messageId: `EMAIL-${Date.now()}`,
                message: 'Email queued (provider not configured)',
                timestamp: new Date().toISOString()
            };
        }

        // In production, integrate with SendGrid/SMTP
        switch (this.emailProvider) {
            case 'sendgrid':
                return this.sendViaSendGrid(request);
            case 'smtp':
                return this.sendViaSMTP(request);
            default:
                return { success: false, error: 'Unknown email provider', timestamp: new Date().toISOString() };
        }
    }

    private async sendViaSendGrid(request: SendNotificationRequest): Promise<NotificationResponse> {
        const { apiKey } = this.emailConfig;
        if (!apiKey) {
            return { success: false, error: 'SendGrid API key not configured', timestamp: new Date().toISOString() };
        }

        // In production, make actual API call
        console.log('Sending via SendGrid:', request);
        return { success: true, messageId: `SG-${Date.now()}`, timestamp: new Date().toISOString() };
    }

    private async sendViaSMTP(request: SendNotificationRequest): Promise<NotificationResponse> {
        const { host, port, user, pass } = this.emailConfig;
        if (!host || !user) {
            return { success: false, error: 'SMTP not configured', timestamp: new Date().toISOString() };
        }

        // In production, use nodemailer
        console.log('Sending via SMTP:', request);
        return { success: true, messageId: `SMTP-${Date.now()}`, timestamp: new Date().toISOString() };
    }

    // ============================================================
    // SMS Implementation
    // ============================================================
    private async sendSMS(request: SendNotificationRequest): Promise<NotificationResponse> {
        if (!request.recipient.phone) {
            return { success: false, error: 'No phone number provided', timestamp: new Date().toISOString() };
        }

        if (this.smsProvider === 'none') {
            // Store for later
            const queued = JSON.parse(localStorage.getItem('sms_queue') || '[]');
            queued.push({ ...request, timestamp: new Date().toISOString() });
            localStorage.setItem('sms_queue', JSON.stringify(queued));

            return {
                success: true,
                messageId: `SMS-${Date.now()}`,
                message: 'SMS queued (provider not configured)',
                timestamp: new Date().toISOString()
            };
        }

        switch (this.smsProvider) {
            case 'megate':
                return this.sendViaMegate(request);
            case 'infobip':
                return this.sendViaInfobip(request);
            case 'twilio':
                return this.sendViaTwilio(request);
            default:
                return { success: false, error: 'Unknown SMS provider', timestamp: new Date().toISOString() };
        }
    }

    private async sendViaMegate(request: SendNotificationRequest): Promise<NotificationResponse> {
        const { apiKey, sender } = this.smsConfig;
        if (!apiKey) {
            return { success: false, error: 'Megate API key not configured', timestamp: new Date().toISOString() };
        }

        // In production, call Megate API
        console.log('Sending via Megate:', request);
        return { success: true, messageId: `MEG-${Date.now()}`, timestamp: new Date().toISOString() };
    }

    private async sendViaInfobip(request: SendNotificationRequest): Promise<NotificationResponse> {
        const { apiKey, baseUrl } = this.smsConfig;
        if (!apiKey) {
            return { success: false, error: 'Infobip API key not configured', timestamp: new Date().toISOString() };
        }

        console.log('Sending via Infobip:', request);
        return { success: true, messageId: `IB-${Date.now()}`, timestamp: new Date().toISOString() };
    }

    private async sendViaTwilio(request: SendNotificationRequest): Promise<NotificationResponse> {
        const { accountSid, authToken, from } = this.smsConfig;
        if (!accountSid || !authToken) {
            return { success: false, error: 'Twilio credentials not configured', timestamp: new Date().toISOString() };
        }

        console.log('Sending via Twilio:', request);
        return { success: true, messageId: `TW-${Date.now()}`, timestamp: new Date().toISOString() };
    }

    // ============================================================
    // WhatsApp Implementation
    // ============================================================
    private async sendWhatsApp(request: SendNotificationRequest): Promise<NotificationResponse> {
        if (!request.recipient.whatsapp && !request.recipient.phone) {
            return { success: false, error: 'No WhatsApp number provided', timestamp: new Date().toISOString() };
        }

        const number = request.recipient.whatsapp || request.recipient.phone;

        // In production, use WhatsApp Business API
        // For now, open WhatsApp web with pre-filled message
        const message = encodeURIComponent(request.content.body);
        const whatsappUrl = `https://wa.me/${number?.replace(/[^0-9]/g, '')}?text=${message}`;

        // Store for reference
        const queued = JSON.parse(localStorage.getItem('whatsapp_queue') || '[]');
        queued.push({ ...request, timestamp: new Date().toISOString(), whatsappUrl });
        localStorage.setItem('whatsapp_queue', JSON.stringify(queued));

        return {
            success: true,
            messageId: `WA-${Date.now()}`,
            message: `WhatsApp URL generated: ${whatsappUrl}`,
            timestamp: new Date().toISOString()
        };
    }

    // ============================================================
    // Print Implementation
    // ============================================================
    private printReceipt(request: SendNotificationRequest): NotificationResponse {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            return { success: false, error: 'Pop-up blocked. Please allow pop-ups for printing.', timestamp: new Date().toISOString() };
        }

        const html = request.content.html || `<pre>${request.content.body}</pre>`;
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();

        // Store print history
        const history = JSON.parse(localStorage.getItem('print_history') || '[]');
        history.push({ timestamp: new Date().toISOString() });
        localStorage.setItem('print_history', JSON.stringify(history.slice(-50)));

        return {
            success: true,
            messageId: `PRINT-${Date.now()}`,
            message: 'Print dialog opened',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get notification statistics
     */
    getStats() {
        return {
            email: {
                queued: JSON.parse(localStorage.getItem('email_queue') || '[]').length
            },
            sms: {
                queued: JSON.parse(localStorage.getItem('sms_queue') || '[]').length
            },
            whatsapp: {
                queued: JSON.parse(localStorage.getItem('whatsapp_queue') || '[]').length
            },
            print: {
                count: JSON.parse(localStorage.getItem('print_history') || '[]').length
            }
        };
    }

    /**
     * Clear queued notifications (for testing)
     */
    clearQueue(channel?: NotificationChannel) {
        if (!channel) {
            localStorage.removeItem('email_queue');
            localStorage.removeItem('sms_queue');
            localStorage.removeItem('whatsapp_queue');
        } else {
            localStorage.removeItem(`${channel}_queue`);
        }
    }
}

export const notificationService = new NotificationService();
export default notificationService;
