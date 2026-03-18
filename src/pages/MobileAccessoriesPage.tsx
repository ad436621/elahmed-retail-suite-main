import MobileSubInventoryPage, { MobileSubInventoryConfig } from '@/components/MobileSubInventoryPage';
import { MOBILE_ACCESSORY_COLUMNS } from '@/services/excelService';
import {
    addMobileAccessory,
    deleteMobileAccessory,
    getMobileAccessories,
    updateMobileAccessory,
} from '@/data/mobilesData';
import { MobileAccessory } from '@/domain/types';
import { STORAGE_KEYS } from '@/config/storageKeys';
import { buildMobileSubInventoryItem } from '@/pages/mobileSubInventoryConfig';

const mobileAccessoriesConfig: MobileSubInventoryConfig<MobileAccessory> = {
    section: 'accessories',
    pageTitle: 'مخزون إكسسوارات الموبايل',
    managerTitle: 'إدارة تصنيفات إكسسوارات الموبايل',
    formSpecsTitle: 'مواصفات المنتج',
    subcategoryPlaceholder: 'مثال: Type-C, شاشة جراب...',
    modelPlaceholder: 'اختياري للإكسسوارات العامة...',
    categoryStorageKey: 'mobiles_acc_cats',
    defaultCategories: ['سماعات سلك', 'سماعات بلوتوث', 'شواحن', 'كابلات', 'باور بنك', 'سكرينات', 'جرابات'],
    inventoryStorageKey: STORAGE_KEYS.MOBILE_ACCESSORIES,
    exportColumns: MOBILE_ACCESSORY_COLUMNS,
    exportFileName: 'اكسسورات_الموبايل',
    barcodePrefix: 'MOB-',
    excelInventoryType: 'mobile',
    getItems: getMobileAccessories,
    addItem: addMobileAccessory,
    updateItem: updateMobileAccessory,
    deleteItem: deleteMobileAccessory,
    buildExcelItem: buildMobileSubInventoryItem<MobileAccessory>,
};

export default function MobileAccessoriesPage() {
    return <MobileSubInventoryPage config={mobileAccessoriesConfig} />;
}
