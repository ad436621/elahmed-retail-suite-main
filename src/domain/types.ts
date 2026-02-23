// ============================================================
// نظام إدارة المحل — Domain Types
// ============================================================

export type UserRole = 'super_admin' | 'admin' | 'employee';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  model: string;
  barcode: string;
  category: string;
  supplier: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  minimumMarginPct: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
// MOBILE INVENTORY
// ============================================================

export interface MobileItem {
  id: string;
  name: string;
  quantity: number;
  storage: string;
  ram: string;
  color: string;
  supplier: string;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  serialNumber: string;
  notes: string;
  description: string;  // detailed product description
  image?: string;       // base64 data URL
  createdAt: string;
  updatedAt: string;
}

export interface MobileAccessory {
  id: string;
  name: string;
  model: string;
  quantity: number;
  color: string;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  notes: string;
  description: string;
  image?: string;
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
  color: string;
  quantity: number;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  notes: string;
  description: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceAccessory {
  id: string;
  name: string;
  model: string;
  quantity: number;
  color: string;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  notes: string;
  description: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// COMPUTER INVENTORY
// ============================================================

export interface ComputerItem {
  id: string;
  name: string;
  model: string;
  color: string;
  quantity: number;
  processor?: string;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  notes: string;
  description: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComputerAccessory {
  id: string;
  name: string;
  model: string;
  quantity: number;
  color: string;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  notes: string;
  description: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// USED DEVICES
// ============================================================

export interface UsedDevice {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  color: string;
  storage: string;
  ram: string;
  condition: string;
  purchasePrice: number;
  salePrice: number;
  description: string;
  image?: string;
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
}

export interface InstallmentScheduleItem {
  month: number;
  dueDate: string;
  amount: number;
  paid: boolean;
}

export interface InstallmentContract {
  id: string;
  contractNumber: string;
  customerName: string;
  customerIdCard: string;
  guarantorName: string;
  guarantorIdCard: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  totalPrice: number;
  downPayment: number;
  months: number;
  monthlyInstallment: number;
  schedule: InstallmentScheduleItem[];
  payments: InstallmentPayment[];
  paidTotal: number;
  remaining: number;
  status: 'active' | 'completed' | 'overdue';
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
