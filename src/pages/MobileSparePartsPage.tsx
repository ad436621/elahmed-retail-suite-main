import MobileSubInventoryPage, { MobileSubInventoryConfig } from '@/components/MobileSubInventoryPage';
import { MOBILE_SPARE_COLUMNS } from '@/services/excelService';
import {
    addMobileSparePart,
    deleteMobileSparePart,
    getMobileSpareParts,
    updateMobileSparePart,
} from '@/data/mobilesData';
import { MobileSparePart } from '@/domain/types';
import { STORAGE_KEYS } from '@/config/storageKeys';
import { buildMobileSubInventoryItem } from '@/pages/mobileSubInventoryConfig';

const mobileSparePartsConfig: MobileSubInventoryConfig<MobileSparePart> = {
    section: 'spare-parts',
    pageTitle: 'مخزون قطع غيار الموبايل',
    managerTitle: 'إدارة تصنيفات قطع غيار الموبايل',
    formSpecsTitle: 'مواصفات القطعة',
    subcategoryPlaceholder: 'مثال: شاشة, بطارية...',
    modelPlaceholder: 'الموديلات المتوافقة...',
    categoryStorageKey: 'mobiles_spare_cats',
    defaultCategories: ['شاشات', 'بطاريات', 'بوردة', 'فلاتات', 'كاميرات', 'سماعات داخلية', 'مايك'],
    inventoryStorageKey: STORAGE_KEYS.MOBILE_SPARE_PARTS,
    exportColumns: MOBILE_SPARE_COLUMNS,
    exportFileName: 'قطع_غيار_الموبايل',
    barcodePrefix: 'SM-',
    excelInventoryType: 'mobile',
    getItems: getMobileSpareParts,
    addItem: addMobileSparePart,
    updateItem: updateMobileSparePart,
    deleteItem: deleteMobileSparePart,
    buildExcelItem: buildMobileSubInventoryItem<MobileSparePart>,
};

export default function MobileSparePartsPage() {
    return <MobileSubInventoryPage config={mobileSparePartsConfig} />;
}
