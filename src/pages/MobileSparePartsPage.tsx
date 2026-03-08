// صفحة قطع غيار الموبيلات — مخزون مستقل جديد
import { Smartphone, Headphones, Wrench } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { mobileSparePartsDB } from '@/data/subInventoryData';

const PARTS_CATEGORIES = ['شاشات', 'بطاريات', 'كاميرات', 'مكبرات صوت', 'ميكروفون', 'فلكسات', 'IC chips', 'بورد', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'قطع غيار الموبيلات',
    icon: <Wrench className="h-5 w-5" />,
    iconBg: 'bg-orange-100 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30',
    iconText: 'text-orange-600 dark:text-orange-400',
    addBtnClass: 'bg-orange-600 hover:bg-orange-700',
    categories: PARTS_CATEGORIES,
    storageKey: 'gx_mobile_spare_parts',
    navButtons: [
        { label: 'الموبيلات', path: '/mobiles', icon: <Smartphone className="h-4 w-4" />, color: 'bg-cyan-600', hoverColor: 'hover:bg-cyan-600', isActive: false },
        { label: 'الإكسسورات', path: '/mobiles/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-cyan-500', hoverColor: 'hover:bg-cyan-500', isActive: false },
        { label: 'قطع الغيار', path: '/mobiles/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: true },
    ],
    getItems: mobileSparePartsDB.get,
    addItem: mobileSparePartsDB.add,
    updateItem: mobileSparePartsDB.update,
    deleteItem: mobileSparePartsDB.remove,
    getCapital: mobileSparePartsDB.capital,
};

export default function MobileSparePartsPage() {
    return <SubSectionPage config={config} />;
}
