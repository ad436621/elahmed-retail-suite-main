// صفحة قطع غيار السيارات
import { Car, Wrench, Fuel } from 'lucide-react';
import SubSectionPage, { SubSectionPageConfig } from '@/components/SubSectionPage';
import { createSubInventory } from '@/data/subInventoryData';
import { STORAGE_KEYS } from '@/config';
import { CAR_SPARE_COLUMNS } from '@/services/excelService';

const db = createSubInventory(STORAGE_KEYS.CAR_SPARE_PARTS);

const PARTS_CATEGORIES = ['محرك', 'فرامل', 'كهرباء', 'تعليق', 'تكييف', 'عادم', 'ترانسميشن', 'هيكل', 'زجاج', 'أخرى'];

const config: SubSectionPageConfig = {
    title: 'قطع غيار السيارات',
    icon: <Wrench className="h-5 w-5" />,
    iconBg: 'bg-red-100 dark:bg-red-500/20 border-red-200 dark:border-red-500/30',
    iconText: 'text-red-600 dark:text-red-400',
    addBtnClass: 'bg-red-600 hover:bg-red-700',
    categories: PARTS_CATEGORIES,
    storageKey: STORAGE_KEYS.CAR_SPARE_PARTS,
    navButtons: [
        { label: 'السيارات', path: '/cars', icon: <Car className="h-4 w-4" />, color: 'bg-sky-600', hoverColor: 'hover:bg-sky-600', isActive: false },
        { label: 'قطع الغيار', path: '/cars/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-red-600', hoverColor: 'hover:bg-red-600', isActive: true },
        { label: 'الزيوت', path: '/cars/oils', icon: <Fuel className="h-4 w-4" />, color: 'bg-amber-600', hoverColor: 'hover:bg-amber-600', isActive: false },
    ],
    getItems: db.get,
    addItem: db.add,
    updateItem: db.update,
    deleteItem: db.remove,
    getCapital: db.capital,
    exportColumns: CAR_SPARE_COLUMNS,
    exportFileName: 'قطع_غيار_السيارات',
};

export default function CarSparePartsPage() {
    return <SubSectionPage config={config} />;
}
