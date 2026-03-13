// صفحة قطع غيار الأجهزة والمنزلية — مخزون مستقل
import { Tv, Headphones, Wrench } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { deviceSparePartsDB } from '@/data/subInventoryData';
import { DEVICE_SPARE_COLUMNS } from '@/services/excelService';

const PARTS_CATEGORIES = ['بورد تليفزيون', 'الباور', 'شاشات', 'سبيكر', 'LED Strips', 'ريموت', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'قطع غيار الأجهزة',
    icon: <Wrench className="h-5 w-5" />,
    iconBg: 'bg-red-100 dark:bg-red-500/20 border-red-200 dark:border-red-500/30',
    iconText: 'text-red-600 dark:text-red-400',
    addBtnClass: 'bg-red-600 hover:bg-red-700',
    categories: PARTS_CATEGORIES,
    storageKey: 'gx_device_spare_parts',
    navButtons: [
        { label: 'الأجهزة والمنزلية', path: '/devices', icon: <Tv className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: false },
        { label: 'الإكسسورات', path: '/devices/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-orange-500', hoverColor: 'hover:bg-orange-500', isActive: false },
        { label: 'قطع الغيار', path: '/devices/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-red-600', hoverColor: 'hover:bg-red-600', isActive: true },
    ],
    getItems: deviceSparePartsDB.get,
    addItem: deviceSparePartsDB.add,
    updateItem: deviceSparePartsDB.update,
    deleteItem: deviceSparePartsDB.remove,
    getCapital: deviceSparePartsDB.capital,
    exportColumns: DEVICE_SPARE_COLUMNS,
    exportFileName: 'قطع_غيار_الأجهزة',
};

export default function DeviceSparePartsPage() {
    return <SubSectionPage config={config} />;
}
