// ═══════════════════════════════════════════════════════════════
// 🛡️ SALES ERROR HANDLER - Unified Error Handling for Sales
// ═══════════════════════════════════════════════════════════════

/**
 * Unified error handling system for sales pages
 * معالجة موحدة للأخطاء في صفحات المبيعات
 */

window.SalesErrorHandler = {
  // ═════════════════════════════════════
  // 📋 ERROR TYPES
  // ═════════════════════════════════════
  ERROR_TYPES: {
    NETWORK: 'NETWORK_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    PERMISSION: 'PERMISSION_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR',
    SERVER: 'SERVER_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
  },

  // ═════════════════════════════════════
  // 🔍 ERROR DETECTION
  // ═════════════════════════════════════

  /**
   * Detect error type from error object
   */
  detectErrorType(error) {
    if (!error) return this.ERROR_TYPES.UNKNOWN;
    
    const errorMessage = error.message || error.toString() || '';
    const errorCode = error.code || error.status || '';
    
    // Network errors
    if (errorMessage.includes('fetch') || 
        errorMessage.includes('network') || 
        errorMessage.includes('Failed to fetch') ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ETIMEDOUT') {
      return this.ERROR_TYPES.NETWORK;
    }
    
    // Validation errors
    if (errorMessage.includes('invalid') ||
        errorMessage.includes('required') ||
        errorMessage.includes('validation') ||
        errorCode === 400) {
      return this.ERROR_TYPES.VALIDATION;
    }
    
    // Permission errors
    if (errorMessage.includes('permission') ||
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorCode === 401 ||
        errorCode === 403) {
      return this.ERROR_TYPES.PERMISSION;
    }
    
    // Not found errors
    if (errorMessage.includes('not found') ||
        errorMessage.includes('not_found') ||
        errorCode === 404) {
      return this.ERROR_TYPES.NOT_FOUND;
    }
    
    // Server errors
    if (errorCode >= 500) {
      return this.ERROR_TYPES.SERVER;
    }
    
    return this.ERROR_TYPES.UNKNOWN;
  },

  // ═════════════════════════════════════
  // 📝 ERROR MESSAGES
  // ═════════════════════════════════════

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error, customMessages = {}) {
    const errorType = this.detectErrorType(error);
    
    // Use custom message if provided
    if (customMessages[errorType]) {
      return customMessages[errorType];
    }
    
    // Default messages
    const defaultMessages = {
      [this.ERROR_TYPES.NETWORK]: 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت.',
      [this.ERROR_TYPES.VALIDATION]: 'البيانات المدخلة غير صحيحة. يرجى التحقق من الحقول.',
      [this.ERROR_TYPES.PERMISSION]: 'ليس لديك صلاحية لتنفيذ هذه العملية.',
      [this.ERROR_TYPES.NOT_FOUND]: 'العنصر المطلوب غير موجود.',
      [this.ERROR_TYPES.SERVER]: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.',
      [this.ERROR_TYPES.UNKNOWN]: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
    };
    
    // Try to extract message from error
    let message = error.message || error.toString() || defaultMessages[errorType];
    
    // Clean up technical error messages
    message = this.cleanErrorMessage(message);
    
    return message;
  },

  /**
   * Clean error message for user display
   */
  cleanErrorMessage(message) {
    // Remove technical prefixes
    message = message.replace(/^Error:\s*/i, '');
    message = message.replace(/^\[.*?\]\s*/g, '');
    
    // Translate common technical terms
    const translations = {
      'device_not_found': 'الجهاز غير موجود',
      'device_not_in_stock': 'الجهاز غير متوفر في المخزون',
      'sale_not_found': 'عملية البيع غير موجودة',
      'already_returned': 'تم إرجاع هذه العملية مسبقاً',
      'INSUFFICIENT_BALANCE': 'الرصيد غير كافٍ',
      'invalid_id': 'معرف غير صحيح',
      'invalid_price': 'السعر غير صحيح',
      'invalid_client_id': 'معرف العميل غير صحيح'
    };
    
    for (const [key, value] of Object.entries(translations)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    return message;
  },

  // ═════════════════════════════════════
  // 🎨 ERROR DISPLAY
  // ═════════════════════════════════════

  /**
   * Show error to user
   */
  showError(error, customMessages = {}, options = {}) {
    const message = this.getErrorMessage(error, customMessages);
    const errorType = this.detectErrorType(error);
    
    // Log error
    Logger.error(`[${errorType}]`, error);
    
    // Show toast notification
    if (window.showToast) {
      const duration = options.duration || 5000;
      window.showToast(message, 'error', duration);
    } else if (window.SalesShared && window.SalesShared.handleApiError) {
      window.SalesShared.handleApiError(error, message);
    } else {
      // Fallback to alert
      alert(message);
    }
    
    // Call custom handler if provided
    if (options.onError && typeof options.onError === 'function') {
      options.onError(error, errorType, message);
    }
    
    return { message, errorType };
  },

  // ═════════════════════════════════════
  // 🔄 ERROR RECOVERY
  // ═════════════════════════════════════

  /**
   * Handle error with recovery strategy
   */
  async handleWithRecovery(operation, recoveryStrategy = null, options = {}) {
    try {
      return await operation();
    } catch (error) {
      const errorInfo = this.showError(error, options.customMessages, options);
      
      // Try recovery if strategy provided
      if (recoveryStrategy && typeof recoveryStrategy === 'function') {
        try {
          return await recoveryStrategy(error, errorInfo);
        } catch (recoveryError) {
          Logger.error('Recovery failed:', recoveryError);
          throw recoveryError;
        }
      }
      
      throw error;
    }
  },

  // ═════════════════════════════════════
  // ✅ VALIDATION
  // ═════════════════════════════════════

  /**
   * Validate input and throw formatted error
   */
  validateInput(value, rules = {}) {
    const errors = [];
    
    // Required check
    if (rules.required && (value === null || value === undefined || value === '')) {
      errors.push(rules.requiredMessage || 'هذا الحقل مطلوب');
    }
    
    // Type check
    if (value !== null && value !== undefined && value !== '') {
      if (rules.type === 'number' && isNaN(Number(value))) {
        errors.push(rules.typeMessage || 'يجب أن يكون رقماً');
      }
      
      if (rules.type === 'integer' && !Number.isInteger(Number(value))) {
        errors.push(rules.typeMessage || 'يجب أن يكون رقماً صحيحاً');
      }
      
      // Min/Max checks
      if (rules.type === 'number' || rules.type === 'integer') {
        const numValue = Number(value);
        
        if (rules.min !== undefined && numValue < rules.min) {
          errors.push(rules.minMessage || `يجب أن يكون أكبر من أو يساوي ${rules.min}`);
        }
        
        if (rules.max !== undefined && numValue > rules.max) {
          errors.push(rules.maxMessage || `يجب أن يكون أصغر من أو يساوي ${rules.max}`);
        }
      }
      
      // Length checks
      if (typeof value === 'string') {
        if (rules.minLength !== undefined && value.length < rules.minLength) {
          errors.push(rules.minLengthMessage || `يجب أن يكون على الأقل ${rules.minLength} حرف`);
        }
        
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          errors.push(rules.maxLengthMessage || `يجب أن يكون على الأكثر ${rules.maxLength} حرف`);
        }
      }
    }
    
    if (errors.length > 0) {
      const error = new Error(errors.join(', '));
      error.type = this.ERROR_TYPES.VALIDATION;
      throw error;
    }
    
    return true;
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.SalesErrorHandler;
}








