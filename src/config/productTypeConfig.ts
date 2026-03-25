export type ProductType = 
    | 'mobile' 
    | 'mobile_accessory' 
    | 'mobile_spare_part' 
    | 'computer' 
    | 'computer_accessory' 
    | 'computer_spare_part';

export interface ProductFieldConfig {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean';
    required: boolean;
    options?: string[]; // for selects
}

export interface ProductTypeDefinition {
    id: ProductType;
    label: string;
    fields: Record<string, ProductFieldConfig>;
    allowedConditions: string[];
}

// ==========================================
// 🧠 Product Type Engine (Business Rules)
// ==========================================
// This configuration acts as the single source of truth for what fields
// are allowed for each product type, preventing field misplacement
// (e.g., IMEI appearing in accessories).
//
// Developers: Use this config when building dynamic forms or filters
// to ensure compliance with the business logic.

const sharedBaseFields: Record<string, ProductFieldConfig> = {
    name: { name: 'name', label: 'اسم المنتج', type: 'text', required: true },
    barcode: { name: 'barcode', label: 'الباركود', type: 'text', required: false },
    category: { name: 'category', label: 'التصنيف', type: 'select', required: true },
    condition: { name: 'condition', label: 'الحالة', type: 'select', required: true, options: ['new', 'like_new', 'used', 'broken'] },
    quantity: { name: 'quantity', label: 'الكمية', type: 'number', required: true },
    newCostPrice: { name: 'newCostPrice', label: 'سعر الشراء', type: 'number', required: true },
    salePrice: { name: 'salePrice', label: 'سعر البيع', type: 'number', required: true },
    color: { name: 'color', label: 'اللون', type: 'text', required: false },
    source: { name: 'source', label: 'المصدر', type: 'text', required: false },
    supplier: { name: 'supplier', label: 'المورد', type: 'text', required: false },
    description: { name: 'description', label: 'الوصف', type: 'text', required: false },
    notes: { name: 'notes', label: 'ملاحظات', type: 'text', required: false },
};

export const productTypeConfig: Record<ProductType, ProductTypeDefinition> = {
    mobile: {
        id: 'mobile',
        label: 'موبايلات وتابلت',
        allowedConditions: ['new', 'like_new', 'used', 'broken'],
        fields: {
            ...sharedBaseFields,
            // 🔴 🔴 🔴
            // IMEI IS MANDATORY FOR MOBILES ONLY
            serialNumber: { name: 'serialNumber', label: 'IMEI 1', type: 'text', required: true },
            imei2: { name: 'imei2', label: 'IMEI 2', type: 'text', required: false },
            
            brand: { name: 'brand', label: 'الشركة المصنعة', type: 'text', required: false },
            model: { name: 'model', label: 'الموديل', type: 'text', required: false },
            storage: { name: 'storage', label: 'مساحة التخزين', type: 'text', required: false },
            ram: { name: 'ram', label: 'الرامات', type: 'text', required: false },
            deviceType: { name: 'deviceType', label: 'نوع الجهاز', type: 'select', required: true, options: ['mobile', 'tablet'] },
        }
    },
    mobile_accessory: {
        id: 'mobile_accessory',
        label: 'إكسسوارات الموبايل',
        allowedConditions: ['new', 'like_new', 'used', 'broken'],
        fields: {
            ...sharedBaseFields,
            // ❌ STRICTLY NO IMEI 
            brand: { name: 'brand', label: 'الشركة (البراند)', type: 'text', required: false },
            model: { name: 'model', label: 'الموديل المتوافق', type: 'text', required: false },
            minStock: { name: 'minStock', label: 'حد التنبيه للمخزون', type: 'number', required: false },
            subcategory: { name: 'subcategory', label: 'التصنيف الفرعي', type: 'text', required: false },
        }
    },
    mobile_spare_part: {
        id: 'mobile_spare_part',
        label: 'قطع غيار الموبايل',
        allowedConditions: ['new', 'like_new', 'used', 'broken'],
        fields: {
            ...sharedBaseFields,
            // ❌ STRICTLY NO IMEI 
            brand: { name: 'brand', label: 'الشركة المصنعة', type: 'text', required: false },
            model: { name: 'model', label: 'موديل الهاتف المرتبط', type: 'text', required: false },
            minStock: { name: 'minStock', label: 'حد التنبيه للمخزون', type: 'number', required: false },
            subcategory: { name: 'subcategory', label: 'التصنيف الفرعي', type: 'text', required: false },
        }
    },
    computer: {
        id: 'computer',
        label: 'أجهزة كمبيوتر ولابتوب',
        allowedConditions: ['new', 'like_new', 'used', 'broken'],
        fields: {
            ...sharedBaseFields,
            // ❌ NO IMEI, allowed processor/ram/storage
            processor: { name: 'processor', label: 'المعالج (Processor)', type: 'text', required: false },
            ram: { name: 'ram', label: 'الرامات (RAM)', type: 'text', required: false },
            storage: { name: 'storage', label: 'التخزين (Storage)', type: 'text', required: false },
            brand: { name: 'brand', label: 'الشركة (البراند)', type: 'text', required: false },
            model: { name: 'model', label: 'الموديل', type: 'text', required: false },
            deviceType: { name: 'deviceType', label: 'النوع', type: 'select', required: true, options: ['computer', 'laptop'] },
        }
    },
    computer_accessory: {
        id: 'computer_accessory',
        label: 'إكسسوارات الكمبيوتر',
        allowedConditions: ['new', 'like_new', 'used', 'broken'],
        fields: {
            ...sharedBaseFields,
            // ❌ NO IMEI/Processor
            brand: { name: 'brand', label: 'الشركة', type: 'text', required: false },
            model: { name: 'model', label: 'الموديل', type: 'text', required: false },
            minStock: { name: 'minStock', label: 'حد التنبيه', type: 'number', required: false },
            subcategory: { name: 'subcategory', label: 'التصنيف الفرعي', type: 'text', required: false },
        }
    },
    computer_spare_part: {
        id: 'computer_spare_part',
        label: 'قطع غيار الكمبيوتر',
        allowedConditions: ['new', 'like_new', 'used', 'broken'],
        fields: {
            ...sharedBaseFields,
            // ❌ NO IMEI/Processor
            brand: { name: 'brand', label: 'الشركة', type: 'text', required: false },
            model: { name: 'model', label: 'الموديل', type: 'text', required: false },
            minStock: { name: 'minStock', label: 'حد التنبيه', type: 'number', required: false },
            subcategory: { name: 'subcategory', label: 'التصنيف الفرعي', type: 'text', required: false },
        }
    }
};

export function getFieldsForType(type: ProductType): Record<string, ProductFieldConfig> {
    return productTypeConfig[type]?.fields || {};
}

export function isFieldAllowed(type: ProductType, fieldName: string): boolean {
    return !!getFieldsForType(type)[fieldName];
}
