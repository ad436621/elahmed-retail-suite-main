// ============================================================
// نظام التحقق — Zod Validation Schemas
// ============================================================

import { z } from 'zod';

// ── Shared Enums ──

export const ProductConditionSchema = z.enum(['new', 'like_new', 'used', 'broken'], {
  required_error: 'حالة المنتج مطلوبة',
  invalid_type_error: 'حالة المنتج غير صحيحة',
});

// ── Shared Rules ──

const requiredString = (field: string) =>
  z.string({ required_error: `${field} مطلوب` }).min(1, `${field} مطلوب`);

const optionalString = () => z.string().optional().default('');

const price = (field: string) =>
  z.number({ required_error: `${field} مطلوب`, invalid_type_error: `${field} لازم يكون رقم` })
    .min(0, `${field} لازم يكون 0 أو أكتر`);

const quantity = () =>
  z.number({ required_error: 'الكمية مطلوبة' })
    .int('الكمية لازم تكون عدد صحيح')
    .min(0, 'الكمية لازم تكون 0 أو أكتر');

// ── Mobile Item ──

export const MobileItemSchema = z.object({
  name: requiredString('اسم المنتج'),
  barcode: z.string().optional(),
  deviceType: z.enum(['mobile', 'tablet']).default('mobile'),
  category: requiredString('التصنيف'),
  condition: ProductConditionSchema.default('new'),
  quantity: quantity(),
  storage: optionalString(),
  ram: optionalString(),
  color: optionalString(),
  brand: optionalString(),
  supplier: optionalString(),
  source: optionalString(),
  oldCostPrice: price('سعر الشراء القديم').default(0),
  newCostPrice: price('سعر الشراء'),
  salePrice: price('سعر البيع'),
  serialNumber: z.string().optional(),
  imei2: z.string().optional(),
  boxNumber: z.string().optional(),
  taxExcluded: z.boolean().optional().default(false),
  description: z.string().optional().default(''),
  image: z.string().optional(),
  warehouseId: z.string().optional(),
  notes: z.string().optional().default(''),
}).refine(d => d.salePrice >= d.newCostPrice, {
  message: 'سعر البيع لازم يكون أكبر من أو يساوي سعر الشراء',
  path: ['salePrice'],
});

// ── Mobile Accessory ──

export const MobileAccessorySchema = z.object({
  name: requiredString('اسم المنتج'),
  model: optionalString(),
  barcode: z.string().optional(),
  category: requiredString('التصنيف'),
  subcategory: optionalString(),
  condition: ProductConditionSchema.default('new'),
  quantity: quantity(),
  brand: optionalString(),
  supplier: optionalString(),
  source: optionalString(),
  color: optionalString(),
  oldCostPrice: price('سعر الشراء القديم').default(0),
  newCostPrice: price('سعر الشراء'),
  salePrice: price('سعر البيع'),
  minStock: z.number().int().min(0).optional().default(0),
  description: z.string().optional().default(''),
  image: z.string().optional(),
  notes: z.string().optional().default(''),
});

// ── Mobile Spare Part ──

export const MobileSparePartSchema = z.object({
  name: requiredString('اسم المنتج'),
  model: optionalString(),
  barcode: z.string().optional(),
  category: requiredString('التصنيف'),
  subcategory: optionalString(),
  condition: ProductConditionSchema.default('new'),
  quantity: quantity(),
  brand: optionalString(),
  supplier: optionalString(),
  source: optionalString(),
  color: optionalString(),
  oldCostPrice: price('سعر الشراء القديم').default(0),
  newCostPrice: price('سعر الشراء'),
  salePrice: price('سعر البيع'),
  minStock: z.number().int().min(0).optional().default(0),
  description: z.string().optional().default(''),
  image: z.string().optional(),
  notes: z.string().optional().default(''),
});

// ── Computer Item ──

export const ComputerItemSchema = z.object({
  name: requiredString('اسم المنتج'),
  model: optionalString(),
  barcode: z.string().optional(),
  deviceType: z.enum(['computer', 'laptop']).default('computer'),
  category: requiredString('التصنيف'),
  condition: ProductConditionSchema.default('new'),
  quantity: quantity(),
  color: optionalString(),
  brand: optionalString(),
  supplier: optionalString(),
  source: optionalString(),
  processor: optionalString(),
  ram: optionalString(),
  storage: optionalString(),
  oldCostPrice: price('سعر الشراء القديم').default(0),
  newCostPrice: price('سعر الشراء'),
  salePrice: price('سعر البيع'),
  minStock: z.number().int().min(0).optional().default(0),
  description: z.string().optional().default(''),
  image: z.string().optional(),
  notes: z.string().optional().default(''),
});

// ── Computer Accessory ──

export const ComputerAccessorySchema = z.object({
  name: requiredString('اسم المنتج'),
  model: optionalString(),
  barcode: z.string().optional(),
  category: requiredString('التصنيف'),
  subcategory: optionalString(),
  condition: ProductConditionSchema.default('new'),
  quantity: quantity(),
  color: optionalString(),
  brand: optionalString(),
  supplier: optionalString(),
  source: optionalString(),
  oldCostPrice: price('سعر الشراء القديم').default(0),
  newCostPrice: price('سعر الشراء'),
  salePrice: price('سعر البيع'),
  minStock: z.number().int().min(0).optional().default(0),
  description: z.string().optional().default(''),
  image: z.string().optional(),
  notes: z.string().optional().default(''),
});

// ── Installment Contract ──

export const InstallmentContractSchema = z.object({
  customerName: requiredString('اسم العميل'),
  customerPhone: requiredString('رقم الهاتف'),
  customerAddress: requiredString('العنوان'),
  customerIdCard: requiredString('رقم البطاقة'),
  guarantorName: requiredString('اسم الضامن'),
  guarantorIdCard: requiredString('بطاقة الضامن'),
  productName: requiredString('اسم المنتج'),
  cashPrice: price('السعر الكاش'),
  installmentPrice: price('سعر التقسيط'),
  downPayment: price('المقدم'),
  months: z.number().int().min(1, 'عدد الأشهر لازم يكون 1 على الأقل'),
  monthlyInstallment: price('القسط الشهري'),
});

// ── Expense ──

export const ExpenseSchema = z.object({
  description: requiredString('الوصف'),
  amount: price('المبلغ').refine(v => v > 0, 'المبلغ لازم يكون أكبر من صفر'),
  category: requiredString('التصنيف'),
});

// ── Helper: extract error messages for form display ──

export type ValidationErrors = Record<string, string>;

export function validateForm<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: ValidationErrors } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: ValidationErrors = {};
  result.error.issues.forEach(issue => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });
  return { success: false, errors };
}
