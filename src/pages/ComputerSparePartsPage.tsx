// صفحة قطع غيار الكمبيوترات — مخزون مستقل
import { Monitor, Headphones, Wrench } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { computerSparePartsDB } from '@/data/subInventoryData';

const PARTS_CATEGORIES = ['رام RAM', 'SSD / HDD', 'بطارية لابتوب', 'شاشة لابتوب', 'كيبورد لابتوب', 'مروحة', 'باور ساندي', 'بورد', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'قطع غيار الكمبيوترات',
    icon: <Wrench className="h-5 w-5" />,
    iconBg: 'bg-orange-100 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30',
    iconText: 'text-orange-600 dark:text-orange-400',
    addBtnClass: 'bg-orange-600 hover:bg-orange-700',
    categories: PARTS_CATEGORIES,
    storageKey: 'gx_computer_spare_parts',
    navButtons: [
        { label: 'الكمبيوترات', path: '/computers', icon: <Monitor className="h-4 w-4" />, color: 'bg-indigo-600', hoverColor: 'hover:bg-indigo-600', isActive: false },
        { label: 'الإكسسورات', path: '/computers/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-500', isActive: false },
        { label: 'قطع الغيار', path: '/computers/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: true },
    ],
    getItems: computerSparePartsDB.get,
    addItem: computerSparePartsDB.add,
    updateItem: computerSparePartsDB.update,
    deleteItem: computerSparePartsDB.remove,
    getCapital: computerSparePartsDB.capital,
};

export default function ComputerSparePartsPage() {
    return <SubSectionPage config={config} />;
}
