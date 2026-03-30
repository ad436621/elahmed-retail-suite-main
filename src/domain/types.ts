// ============================================================
// نظام إدارة المحل — Domain Types
// ============================================================

// Must match usersData.ts UserRole — 'owner' is the super user, 'user' is a staff member
// Extended with legacy role names used in discount rules and permission checks
export type UserRole = 'owner' | 'user' | 'super_admin' | 'admin' | 'employee';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  permissions: string[];
  active: boolean;
}

export type ProductSource =
  | 'mobile'
  | 'mobile_acc'
  | 'mobile_spare'
  | 'computer'
  | 'computer_acc'
  | 'computer_spare'
  | 'device'
  | 'device_acc'
  | 'device_spare'
  | 'car'
  | 'car_spare'
  | 'legacy';

export type ProductCondition = 'new' | 'like_new' | 'used' | 'broken';

export interface Product {
  id: string;
  name: string;
  model: string;
  barcode: string;
  category: string;
  categoryId?: string;
  source?: ProductSource;
  condition?: ProductCondition;
  supplier: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minimumMarginPct: number;
  image?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  warehouseId?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  lineDiscount: number;
}

export type PaymentMethod = 'cash' | 'card' | 'split';

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
  lineDiscount: number;
  batches?: BatchSaleResult['batches']; // To track exact FIFO deductions for returns/profits
  warehouseId?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number;
  grossProfit: number;
  marginPct: number;
  paymentMethod: PaymentMethod;
  employee: string;
  status?: 'active' | 'deleted';
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: string | null;
}

export type StockMovementType = 'sale' | 'return' | 'manual_adjustment' | 'import' | 'correction';

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  referenceId: string | null;
  userId: string;
  timestamp: string;
  warehouseId?: string;
}

export type AuditAction =
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'price_changed'
  | 'sale_completed'
  | 'sale_voided'
  | 'stock_adjusted'
  | 'return_processed'
  | 'discount_applied'
  | 'settings_changed'
  | 'user_login'
  | 'user_logout';

export interface AuditEntry {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  machineId: string;
  timestamp: string;
}

export interface DiscountRule {
  role: UserRole;
  maxLinePct: number;
  maxInvoicePct: number;
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  oldCostPrice: number;
  newCostPrice: number;
  oldSellingPrice: number;
  newSellingPrice: number;
  changedBy: string;
  timestamp: string;
}

// ============================================================
// PRODUCT BATCHES — نظام الدفعات
// ============================================================

export type BatchInventoryType =
  | 'mobile'
  | 'mobile_accessory'
  | 'mobile_spare_part'
  | 'device'
  | 'device_accessory'
  | 'computer'
  | 'computer_accessory'
  | 'used_device'
  | 'car'
  | 'warehouse';

export interface ProductBatch {
  id: string;
  productId: string;           // ID المنتج الأصلي (MobileItem.id مثلاً)
  inventoryType: BatchInventoryType;
  productName: string;         // نسخة من اسم المنتج للعرض السريع
  costPrice: number;           // سعر التكلفة لهذه الدفعة تحديداً
  salePrice: number;           // سعر البيع المقترح لهذه الدفعة
  quantity: number;            // الكمية الأصلية في الدفعة
  remainingQty: number;        // الكمية المتبقية (تقل مع كل بيع)
  purchaseDate: string;        // تاريخ الشراء (ISO string)
  supplier: string;            // المورد
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchSaleResult {
  batches: Array<{
    batchId: string;
    qtyFromBatch: number;
    costPrice: number;         // تكلفة هذه الدفعة
    salePrice: number;
    profit: number;
  }>;
  totalCost: number;
  totalProfit: number;
}

// ============================================================
// MOBILE INVENTORY
// ============================================================

export type MobileDeviceType = 'mobile' | 'tablet';

export interface MobileItem {
  id: string;
  name: string;
  barcode?: string;
  deviceType: MobileDeviceType; // mobile or tablet
  category?: string;
  condition?: ProductCondition;
  quantity: number;
  boxNumber?: string;
  source?: string;
  taxExcluded?: boolean;
  storage: string;
  ram: string;
  color: string;
  model?: string;
  brand?: string;             // اسم الشركة المصنعة (يدوي)
  supplier: string;
  oldCostPrice: number;       // @deprecated — use costPrice
  newCostPrice: number;       // سعر الشراء (التكلفة)
  costPrice?: number;         // alias for newCostPrice
  salePrice: number;
  profitMargin?: number;      // هامش الربح = salePrice - costPrice
  serialNumber: string;       // IMEI 1
  imei2?: string;             // IMEI 2 (اختياري)
  notes: string;
  description: string;  // detailed product description
  image?: string;       // base64 data URL
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

export interface MobileAccessory {
  id: string;
  name: string;
  model: string;
  barcode?: string;
  category?: string;
  subcategory: string;
  quantity: number;
  condition?: ProductCondition;
  boxNumber?: string;
  source?: string;
  taxExcluded?: boolean;
  brand?: string;             // اسم الشركة (يدوي — مستقل عن شركات الموبايل)
  supplier?: string;
  color: string;
  oldCostPrice: number;       // @deprecated
  newCostPrice: number;
  costPrice?: number;         // alias for newCostPrice
  salePrice: number;
  profitMargin?: number;      // هامش الربح = salePrice - costPrice
  minStock?: number;          // حد التنبيه
  notes: string;
  description: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

export interface MobileSparePart {
  id: string;
  name: string;
  model: string;
  barcode?: string;
  category?: string;
  subcategory: string;
  quantity: number;
  condition?: ProductCondition;
  boxNumber?: string;
  source?: string;
  taxExcluded?: boolean;
  brand?: string;             // الشركة المصنعة
  supplier?: string;
  color: string;
  oldCostPrice: number;       // @deprecated
  newCostPrice: number;
  costPrice?: number;         // alias for newCostPrice
  salePrice: number;
  profitMargin?: number;      // هامش الربح
  minStock?: number;          // حد التنبيه
  notes: string;
  description: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// DEVICE INVENTORY
// ============================================================

export interface DeviceItem {
  id: string;
  name: string;
  model: string;
  barcode?: string;
  category?: string;
  condition?: ProductCondition;
  color: string;
  brand?: string;             // الشركة المصنعة
  supplier?: string;          // المورد
  source?: string;            // المصدر
  quantity: number;
  oldCostPrice: number;       // @deprecated
  newCostPrice: number;
  costPrice?: number;
  salePrice: number;
  profitMargin?: number;
  minStock?: number;
  notes: string;
  description: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

export interface DeviceAccessory {
  id: string;
  name: string;
  model: string;
  barcode?: string;
  category?: string;
  subcategory: string;
  condition?: ProductCondition;
  quantity: number;
  color: string;
  brand?: string;
  supplier?: string;
  source?: string;
  oldCostPrice: number;       // @deprecated
  newCostPrice: number;
  costPrice?: number;
  salePrice: number;
  profitMargin?: number;
  minStock?: number;
  notes: string;
  description: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// COMPUTER INVENTORY
// ============================================================

export type ComputerDeviceType = 'computer' | 'laptop';

export interface ComputerItem {
  id: string;
  name: string;
  model: string;
  barcode?: string;
  deviceType: ComputerDeviceType; // computer or laptop
  category?: string;
  condition?: ProductCondition;
  color: string;
  brand?: string;             // الشركة المصنعة
  supplier?: string;          // المورد
  source?: string;            // المصدر
  quantity: number;
  processor?: string;
  ram?: string;               // الرامات
  storage?: string;           // التخزين
  oldCostPrice: number;       // @deprecated
  newCostPrice: number;
  costPrice?: number;
  salePrice: number;
  profitMargin?: number;      // هامش الربح
  minStock?: number;
  notes: string;
  description: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

export interface ComputerAccessory {
  id: string;
  name: string;
  model: string;
  barcode?: string;
  category?: string;
  subcategory: string;
  condition?: ProductCondition;
  quantity: number;
  color: string;
  brand?: string;             // الشركة المصنعة
  supplier?: string;          // المورد
  source?: string;            // المصدر
  oldCostPrice: number;       // @deprecated
  newCostPrice: number;
  costPrice?: number;
  salePrice: number;
  profitMargin?: number;
  minStock?: number;
  notes: string;
  description: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// USED DEVICES
// ============================================================

export type UsedDeviceType = 'mobile' | 'tablet' | 'computer' | 'laptop' | 'other';

export interface UsedDevice {
  id: string;
  name: string;
  model: string;
  deviceType: UsedDeviceType; // mobile, tablet, computer, laptop, or other
  serialNumber: string;
  color: string;
  storage: string;
  ram: string;
  condition: string;
  purchasePrice: number;
  salePrice: number;
  description: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// MAINTENANCE ORDERS
// ============================================================

export interface SparePart {
  name: string;
  costPrice: number;   // internal cost (not shown to customer)
  salePrice: number;   // charged to customer
}

export interface MaintenanceOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  date: string;
  deviceName: string;
  deviceCategory: 'mobile' | 'tablet' | 'computer' | 'laptop' | 'device' | 'other';
  issueDescription: string;
  spareParts: SparePart[];
  totalCost: number;
  totalSale: number;
  netProfit: number;
  status: 'pending' | 'in_progress' | 'done' | 'delivered';
  description: string;   // technician notes / description
  image?: string;        // device photo base64
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// INSTALLMENT CONTRACTS
// ============================================================

export interface InstallmentPayment {
  id: string;
  amount: number;
  date: string;
  note: string;
  allocations?: Array<{
    scheduleItemId: string;
    amount: number;
  }>;
}

export interface InstallmentScheduleItem {
  id?: string;
  month: number;
  dueDate: string;
  amount: number;
  paidAmount: number; // For tracking partial payments
  penalty: number;    // For adding late fees
  paid: boolean;
  remainingAfter?: number;
  note?: string;
}

export interface InstallmentCustomField {
  id: string;
  label: string;
  value: string;
}

export interface InstallmentContract {
  id: string;
  contractNumber: string;
  // Contract type: product sale on installment, transfer, or car
  contractType?: 'product' | 'transfer' | 'car';
  customerName: string;
  customerIdCard: string;
  guarantorName: string;
  guarantorIdCard: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  productId?: string;
  // For transfer contracts: the wallet/operator used (e.g. "فودافون كاش")
  transferType?: string;
  cashPrice: number;
  installmentPrice: number;
  downPayment: number;
  months: number;
  monthlyInstallment: number;
  firstInstallmentDate?: string;
  schedule: InstallmentScheduleItem[];
  payments: InstallmentPayment[];
  paidTotal: number;
  remaining: number;
  notes?: string;
  customFields?: InstallmentCustomField[];
  status: 'active' | 'completed' | 'overdue';
  settledEarly?: boolean;
  settlementDiscount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// RETURNS
// ============================================================

export interface ReturnItem {
  productId: string;  // original sale item productId
  name: string;
  qty: number;
  price: number;
  reason: string;
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  originalInvoiceNumber: string;
  originalSaleId: string;
  date: string;
  items: ReturnItem[];
  totalRefund: number;
  createdAt: string;
}

// ============================================================
// EXPENSES
// ============================================================

export type ExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salaries'
  | 'supplies'
  | 'maintenance'
  | 'transport'
  | 'other';

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  addedBy: string;
  createdAt: string;
}

// ============================================================
// DAMAGED / WASTE ITEMS
// ============================================================

export type DamagedItemCategory = 'mobile' | 'accessory' | 'device' | 'computer' | 'cable' | 'other';

export interface DamagedItem {
  id: string;
  date: string;
  productName: string;
  productId?: string;   // if registered in inventory
  quantity: number;
  costPrice: number;
  totalLoss: number;
  reason: string;
  category: DamagedItemCategory;
  addedBy: string;
  createdAt: string;
}

// ============================================================
// CARS INVENTORY
// ============================================================

export interface CarItem {
  id: string;
  name: string;            // car name
  model: string;           // model
  year: number;            // manufacture year
  color: string;
  plateNumber: string;     // plate number
  licenseExpiry: string;   // license expiry date
  condition: 'new' | 'used';
  category?: string;       // car category
  purchasePrice: number;   // purchase price
  salePrice: number;       // sale price
  notes: string;
  image?: string;
  warehouseId?: string; // Phase 4
  isArchived?: boolean; // Phase 4
  deletedAt?: string | null; // Phase 4
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// WAREHOUSE
// ============================================================

export interface WarehouseItem {
  id: string;
  name: string;
  category: string;     // cables / chargers / headphones / etc
  quantity: number;
  costPrice: number;
  notes: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// OTHER REVENUE
// ============================================================

export interface OtherRevenue {
  id: string;
  date: string;
  description: string;      // example: "Samsung commission for March"
  amount: number;
  category: string;         // example: "distributor commission" / "cash loading" / "other"
  addedBy: string;
  createdAt: string;
}


