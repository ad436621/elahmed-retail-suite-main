import { Headphones, Monitor, Wrench } from 'lucide-react';
import TechSubInventoryPage, { type TechSubInventoryConfig } from '@/components/TechSubInventoryPage';
import { getComputers } from '@/data/computersData';
import { computerSparePartsDB } from '@/data/subInventoryData';
import { STORAGE_KEYS } from '@/config/storageKeys';
import { COMPUTER_SPARE_COLUMNS } from '@/services/excelService';

const PARTS_CATEGORIES = ['RAM', 'SSD / HDD', 'بطارية لابتوب', 'شاشة لابتوب', 'كيبورد لابتوب', 'مروحة', 'Power Supply', 'Motherboard', 'أخرى'];

const config: TechSubInventoryConfig = {
  section: 'spare-parts',
  title: 'قطع غيار الكمبيوتر',
  managerTitle: 'إدارة تصنيفات قطع غيار الكمبيوتر',
  formTitle: 'مواصفات القطعة',
  icon: <Wrench className="h-5 w-5" />,
  iconBg: 'bg-orange-100 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30',
  iconText: 'text-orange-600 dark:text-orange-400',
  addBtnClass: 'bg-orange-600 hover:bg-orange-700',
  categories: PARTS_CATEGORIES,
  categoryStorageKey: 'computer_spare_parts_cats_v2',
  storageKey: STORAGE_KEYS.COMPUTER_SPARE_PARTS,
  navButtons: [
    { label: 'الكمبيوتر', path: '/computers', icon: <Monitor className="h-4 w-4" />, color: 'bg-indigo-600', hoverColor: 'hover:bg-indigo-600', isActive: false },
    { label: 'الاكسسوارات', path: '/computers/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-500', isActive: false },
    { label: 'قطع الغيار', path: '/computers/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: true },
  ],
  companySource: { getItems: getComputers, storageKeys: [STORAGE_KEYS.COMPUTERS] },
  getItems: computerSparePartsDB.get,
  addItem: computerSparePartsDB.add,
  updateItem: computerSparePartsDB.update,
  deleteItem: computerSparePartsDB.remove,
  exportColumns: COMPUTER_SPARE_COLUMNS,
  exportFileName: 'قطع_غيار_الكمبيوتر',
  excelInventoryType: 'accessory',
  barcodePrefix: 'CSP-',
};

export default function ComputerSparePartsPage() {
  return <TechSubInventoryPage config={config} />;
}
