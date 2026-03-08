// صفحة اكسسورات الأجهزة والمنزلية — مخزون مستقل
import { Tv, Headphones, Wrench } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { deviceAccessoriesDB } from '@/data/subInventoryData';

const ACC_CATEGORIES = ['ريموت', 'كابلات HDMI', 'حوامل', 'فلاتر', 'مجففات فلاتر', 'أحزمة', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'اكسسورات الأجهزة',
    icon: <Headphones className="h-5 w-5" />,
    iconBg: 'bg-orange-100 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30',
    iconText: 'text-orange-600 dark:text-orange-400',
    addBtnClass: 'bg-orange-500 hover:bg-orange-600',
    categories: ACC_CATEGORIES,
    storageKey: 'gx_device_accessories_sa',
    navButtons: [
        { label: 'الأجهزة والمنزلية', path: '/devices', icon: <Tv className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: false },
        { label: 'الإكسسورات', path: '/devices/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-orange-500', hoverColor: 'hover:bg-orange-500', isActive: true },
        { label: 'قطع الغيار', path: '/devices/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-red-600', hoverColor: 'hover:bg-red-600', isActive: false },
    ],
    getItems: deviceAccessoriesDB.get,
    addItem: deviceAccessoriesDB.add,
    updateItem: deviceAccessoriesDB.update,
    deleteItem: deviceAccessoriesDB.remove,
    getCapital: deviceAccessoriesDB.capital,
};

export default function DeviceAccessoriesPage() {
    return <SubSectionPage config={config} />;
}
