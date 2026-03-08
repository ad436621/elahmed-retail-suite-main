// صفحة اكسسورات الموبيلات — تعيد استخدام البيانات الموجودة في mobilesData
import { Smartphone, Headphones, Wrench } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { getMobileAccessories, addMobileAccessory, updateMobileAccessory, deleteMobileAccessory } from '@/data/mobilesData';

const ACT_CATEGORIES = ['سماعات', 'كفرات', 'شواحن', 'كابلات', 'لاقطات', 'حماية شاشة', 'بطاريات', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'اكسسورات الموبيلات',
    icon: <Headphones className="h-5 w-5" />,
    iconBg: 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-200 dark:border-cyan-500/30',
    iconText: 'text-cyan-600 dark:text-cyan-400',
    addBtnClass: 'bg-cyan-600 hover:bg-cyan-700',
    categories: ACT_CATEGORIES,
    storageKey: 'gx_mobile_accessories',
    navButtons: [
        { label: 'الموبيلات', path: '/mobiles', icon: <Smartphone className="h-4 w-4" />, color: 'bg-cyan-600', hoverColor: 'hover:bg-cyan-600', isActive: false },
        { label: 'الإكسسورات', path: '/mobiles/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-cyan-500', hoverColor: 'hover:bg-cyan-500', isActive: true },
        { label: 'قطع الغيار', path: '/mobiles/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: false },
    ],
    getItems: getMobileAccessories as any,
    addItem: (item) => addMobileAccessory({ ...item, subcategory: '', notes: item.notes ?? '' } as any) as any,
    updateItem: (id, updates) => updateMobileAccessory(id, updates as any),
    deleteItem: deleteMobileAccessory,
};

export default function MobileAccessoriesPage() {
    return <SubSectionPage config={config} />;
}
