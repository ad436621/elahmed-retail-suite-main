// صفحة الزيوت — قسم السيارات
import { Car, Wrench, Fuel } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { createSubInventory } from '@/data/subInventoryData';
import { STORAGE_KEYS } from '@/config';

const db = createSubInventory(STORAGE_KEYS.CAR_OILS);

const OIL_CATEGORIES = ['زيت محرك', 'زيت فتيس', 'زيت دركسيون', 'زيت فرامل', 'مياه راديتر', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'الزيوت — قسم السيارات',
    icon: <Fuel className="h-5 w-5" />,
    iconBg: 'bg-amber-100 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30',
    iconText: 'text-amber-600 dark:text-amber-400',
    addBtnClass: 'bg-amber-600 hover:bg-amber-700',
    categories: OIL_CATEGORIES,
    storageKey: STORAGE_KEYS.CAR_OILS,
    navButtons: [
        { label: 'السيارات', path: '/cars', icon: <Car className="h-4 w-4" />, color: 'bg-sky-600', hoverColor: 'hover:bg-sky-600', isActive: false },
        { label: 'قطع الغيار', path: '/cars/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-red-600', hoverColor: 'hover:bg-red-600', isActive: false },
        { label: 'الزيوت', path: '/cars/oils', icon: <Fuel className="h-4 w-4" />, color: 'bg-amber-600', hoverColor: 'hover:bg-amber-600', isActive: true },
    ],
    getItems: db.get,
    addItem: db.add,
    updateItem: db.update,
    deleteItem: db.remove,
    getCapital: db.capital,
};

export default function CarOilsPage() {
    return <SubSectionPage config={config} />;
}
