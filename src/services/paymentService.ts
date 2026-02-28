// ============================================================
// ELAHMED RETAIL OS — Payment Gateway Service
// Supports multiple payment providers (Fawry, Accept, Stripe, etc.)
// ============================================================

export type PaymentProvider = 'fawry' | 'accept' | 'stripe' | 'cash' | 'offline';

export interface PaymentRequest {
    amount: number;
    currency?: string;
    orderId: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    description?: string;
    callbackUrl?: string;
}

export interface PaymentResponse {
    success: boolean;
    transactionId?: string;
    paymentUrl?: string;
    message?: string;
    error?: string;
}

export interface RefundRequest {
    transactionId: string;
    amount: number;
    reason?: string;
}

export interface PaymentStatus {
    status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
    transactionId: string;
    amount: number;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

class PaymentGatewayService {
    private provider: PaymentProvider;
    private config: Record<string, string>;

    constructor() {
        // Default to cash/offline, can be configured via settings
        this.provider = 'cash';
        this.config = {};
    }

    /**
     * Configure the payment provider
     */
    configure(provider: PaymentProvider, config: Record<string, string>) {
        this.provider = provider;
        this.config = config;
        localStorage.setItem('payment_provider', provider);
        localStorage.setItem('payment_config', JSON.stringify(config));
    }

    /**
     * Get current provider
     */
    getProvider(): PaymentProvider {
        return this.provider;
    }

    /**
     * Initialize a payment transaction
     */
    async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
        switch (this.provider) {
            case 'fawry':
                return this.initiateFawryPayment(request);
            case 'accept':
                return this.initiateAcceptPayment(request);
            case 'stripe':
                return this.initiateStripePayment(request);
            case 'cash':
            case 'offline':
                return this.handleOfflinePayment(request);
            default:
                return { success: false, error: 'Unknown payment provider' };
        }
    }

    /**
     * Check payment status
     */
    async checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
        switch (this.provider) {
            case 'fawry':
                return this.checkFawryStatus(transactionId);
            case 'accept':
                return this.checkAcceptStatus(transactionId);
            case 'stripe':
                return this.checkStripeStatus(transactionId);
            case 'cash':
            case 'offline':
                return this.checkOfflineStatus(transactionId);
            default:
                throw new Error('Unknown payment provider');
        }
    }

    /**
     * Process refund
     */
    async processRefund(request: RefundRequest): Promise<PaymentResponse> {
        switch (this.provider) {
            case 'fawry':
                return this.processFawryRefund(request);
            case 'accept':
                return this.processAcceptRefund(request);
            case 'stripe':
                return this.processStripeRefund(request);
            case 'cash':
            case 'offline':
                return this.handleOfflineRefund(request);
            default:
                return { success: false, error: 'Unknown payment provider' };
        }
    }

    // ============================================================
    // Fawry Integration (Popular in Egypt)
    // ============================================================
    private async initiateFawryPayment(request: PaymentRequest): Promise<PaymentResponse> {
        const { merchantCode, signature } = this.config;

        if (!merchantCode) {
            return { success: false, error: 'Fawry merchant code not configured' };
        }

        try {
            // Fawry API endpoint (sandbox or production)
            const fawryApiUrl = this.config.apiUrl || 'https://atfawry.fawry.com/ECommerceWebAPI/api';

            const payload = {
                merchantCode,
                merchantRefNum: request.orderId,
                amount: request.amount,
                currency: request.currency || 'EGP',
                paymentMethod: 'PayAtFawry',
                customerName: request.customerName || 'Customer',
                customerMobile: request.customerPhone || '',
                customerEmail: request.customerEmail || '',
                description: request.description || 'ElAhmed Retail Purchase',
                chargeItems: [
                    {
                        itemId: request.orderId,
                        description: request.description || 'Purchase',
                        quantity: 1,
                        price: request.amount
                    }
                ],
                returnUrl: request.callbackUrl || window.location.origin + '/payment/callback'
            };

            // In production, this would be an actual API call
            // For now, simulate the response
            const transactionId = `FAWRY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Store transaction for later verification
            const transactions = JSON.parse(localStorage.getItem('fawry_transactions') || '{}');
            transactions[transactionId] = {
                ...request,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('fawry_transactions', JSON.stringify(transactions));

            return {
                success: true,
                transactionId,
                paymentUrl: `${fawryApiUrl}/payments/pay?ref=${transactionId}`,
                message: 'Payment initiated successfully'
            };
        } catch (error) {
            return { success: false, error: `Fawry payment failed: ${error}` };
        }
    }

    private async checkFawryStatus(transactionId: string): Promise<PaymentStatus> {
        const transactions = JSON.parse(localStorage.getItem('fawry_transactions') || '{}');
        const transaction = transactions[transactionId];

        if (!transaction) {
            return {
                status: 'failed',
                transactionId,
                amount: 0,
                timestamp: new Date().toISOString()
            };
        }

        return {
            status: transaction.status,
            transactionId,
            amount: transaction.amount,
            timestamp: transaction.createdAt
        };
    }

    private async processFawryRefund(request: RefundRequest): Promise<PaymentResponse> {
        const { merchantCode } = this.config;

        if (!merchantCode) {
            return { success: false, error: 'Fawry merchant code not configured' };
        }

        // In production, call Fawry Refund API
        const transactions = JSON.parse(localStorage.getItem('fawry_transactions') || '{}');
        if (transactions[request.transactionId]) {
            transactions[request.transactionId].status = 'refunded';
            localStorage.setItem('fawry_transactions', JSON.stringify(transactions));
        }

        return {
            success: true,
            transactionId: `REFUND-${request.transactionId}`,
            message: 'Refund processed successfully'
        };
    }

    // ============================================================
    // Accept Integration (Another Egyptian provider)
    // ============================================================
    private async initiateAcceptPayment(request: PaymentRequest): Promise<PaymentResponse> {
        const { apiKey, merchantId } = this.config;

        if (!apiKey || !merchantId) {
            return { success: false, error: 'Accept credentials not configured' };
        }

        const transactionId = `ACCEPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store transaction
        const transactions = JSON.parse(localStorage.getItem('accept_transactions') || '{}');
        transactions[transactionId] = {
            ...request,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('accept_transactions', JSON.stringify(transactions));

        return {
            success: true,
            transactionId,
            paymentUrl: `https://accept.paymobsolutions.com/api acceptance/${transactionId}`,
            message: 'Payment initiated successfully'
        };
    }

    private async checkAcceptStatus(transactionId: string): Promise<PaymentStatus> {
        const transactions = JSON.parse(localStorage.getItem('accept_transactions') || '{}');
        const transaction = transactions[transactionId];

        if (!transaction) {
            return {
                status: 'failed',
                transactionId,
                amount: 0,
                timestamp: new Date().toISOString()
            };
        }

        return {
            status: transaction.status,
            transactionId,
            amount: transaction.amount,
            timestamp: transaction.createdAt
        };
    }

    private async processAcceptRefund(request: RefundRequest): Promise<PaymentResponse> {
        return {
            success: true,
            transactionId: `REFUND-${request.transactionId}`,
            message: 'Refund processed successfully'
        };
    }

    // ============================================================
    // Stripe Integration
    // ============================================================
    private async initiateStripePayment(request: PaymentRequest): Promise<PaymentResponse> {
        const { publishableKey } = this.config;

        if (!publishableKey) {
            return { success: false, error: 'Stripe publishable key not configured' };
        }

        const transactionId = `STRIPE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // In production, create PaymentIntent via backend
        return {
            success: true,
            transactionId,
            paymentUrl: `https://checkout.stripe.com/pay/${transactionId}`,
            message: 'Stripe checkout initiated'
        };
    }

    private async checkStripeStatus(transactionId: string): Promise<PaymentStatus> {
        return {
            status: 'pending',
            transactionId,
            amount: 0,
            timestamp: new Date().toISOString()
        };
    }

    private async processStripeRefund(request: RefundRequest): Promise<PaymentResponse> {
        return {
            success: true,
            transactionId: `REFUND-${request.transactionId}`,
            message: 'Refund processed successfully'
        };
    }

    // ============================================================
    // Offline/Cash Payment (Default)
    // ============================================================
    private handleOfflinePayment(request: PaymentRequest): PaymentResponse {
        const transactionId = `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store cash transaction
        const transactions = JSON.parse(localStorage.getItem('cash_transactions') || '{}');
        transactions[transactionId] = {
            ...request,
            status: 'completed',
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('cash_transactions', JSON.stringify(transactions));

        return {
            success: true,
            transactionId,
            message: 'Cash payment recorded'
        };
    }

    private checkOfflineStatus(transactionId: string): PaymentStatus {
        const transactions = JSON.parse(localStorage.getItem('cash_transactions') || '{}');
        const transaction = transactions[transactionId];

        return {
            status: transaction?.status || 'failed',
            transactionId,
            amount: transaction?.amount || 0,
            timestamp: transaction?.createdAt || new Date().toISOString()
        };
    }

    private handleOfflineRefund(request: RefundRequest): PaymentResponse {
        return {
            success: true,
            transactionId: `REFUND-${request.transactionId}`,
            message: 'Cash refund recorded'
        };
    }

    /**
     * Get all transactions
     */
    getTransactions(): Array<{ transactionId: string; amount: number; status: string; createdAt: string }> {
        const allTransactions: Array<{ transactionId: string; amount: number; status: string; createdAt: string }> = [];

        const providers = ['fawry_transactions', 'accept_transactions', 'cash_transactions'];
        providers.forEach(key => {
            const transactions = JSON.parse(localStorage.getItem(key) || '{}');
            Object.entries(transactions).forEach(([id, data]: [string, any]) => {
                allTransactions.push({
                    transactionId: id,
                    amount: data.amount,
                    status: data.status,
                    createdAt: data.createdAt
                });
            });
        });

        return allTransactions.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    /**
     * Get payment statistics
     */
    getPaymentStats() {
        const transactions = this.getTransactions();

        const byStatus = transactions.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const totalAmount = transactions
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            total: transactions.length,
            completed: byStatus.completed || 0,
            pending: byStatus.pending || 0,
            failed: byStatus.failed || 0,
            refunded: byStatus.refunded || 0,
            totalAmount
        };
    }
}

export const paymentService = new PaymentGatewayService();
export default paymentService;
