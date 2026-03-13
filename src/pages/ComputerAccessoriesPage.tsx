// صفحة اكسسورات الكمبيوترات — مخزون مستقل
import { Monitor, Headphones, Wrench } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { computerAccessoriesDB } from '@/data/subInventoryData';
import { COMPUTER_ACCESSORY_COLUMNS } from '@/services/excelService';

const ACC_CATEGORIES = ['ماوس', 'كيبورد', 'شنطة', 'شاشة', 'سماعة', 'كاميرا ويب', 'ماوس باد', 'USB Hub', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'اكسسورات الكمبيوترات',
    icon: <Headphones className="h-5 w-5" />,
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    addBtnClass: 'bg-indigo-600 hover:bg-indigo-700',
    categories: ACC_CATEGORIES,
    storageKey: 'gx_computer_accessories_sa',
    navButtons: [
        { label: 'الكمبيوترات', path: '/computers', icon: <Monitor className="h-4 w-4" />, color: 'bg-indigo-600', hoverColor: 'hover:bg-indigo-600', isActive: false },
        { label: 'الإكسسورات', path: '/computers/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-500', isActive: true },
        { label: 'قطع الغيار', path: '/computers/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: false },
    ],
    getItems: computerAccessoriesDB.get,
    addItem: computerAccessoriesDB.add,
    updateItem: computerAccessoriesDB.update,
    deleteItem: computerAccessoriesDB.remove,
    getCapital: computerAccessoriesDB.capital,
    exportColumns: COMPUTER_ACCESSORY_COLUMNS,
    exportFileName: 'اكسسورات_الكمبيوترات',
};

export default function ComputerAccessoriesPage() {
    return <SubSectionPage config={config} />;
}
