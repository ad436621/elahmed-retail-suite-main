import { Headphones, Monitor, Wrench } from 'lucide-react';
import TechSubInventoryPage, { type TechSubInventoryConfig } from '@/components/TechSubInventoryPage';
import { getComputers } from '@/data/computersData';
import { computerAccessoriesDB } from '@/data/subInventoryData';
import { STORAGE_KEYS } from '@/config/storageKeys';
import { COMPUTER_ACCESSORY_COLUMNS } from '@/services/excelService';

const ACC_CATEGORIES = ['ماوس', 'كيبورد', 'شنطة', 'شاشة', 'سماعة', 'كاميرا ويب', 'Mouse Pad', 'USB Hub', 'أخرى'];

const config: TechSubInventoryConfig = {
  section: 'accessories',
  title: 'اكسسوارات الكمبيوتر',
  managerTitle: 'إدارة تصنيفات اكسسوارات الكمبيوتر',
  formTitle: 'مواصفات الاكسسوار',
  icon: <Headphones className="h-5 w-5" />,
  iconBg: 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30',
  iconText: 'text-indigo-600 dark:text-indigo-400',
  addBtnClass: 'bg-indigo-600 hover:bg-indigo-700',
  categories: ACC_CATEGORIES,
  categoryStorageKey: 'computer_accessories_cats_v2',
  storageKey: STORAGE_KEYS.COMPUTER_ACCESSORIES_SA,
  navButtons: [
    { label: 'الكمبيوتر', path: '/computers', icon: <Monitor className="h-4 w-4" />, color: 'bg-indigo-600', hoverColor: 'hover:bg-indigo-600', isActive: false },
    { label: 'الاكسسوارات', path: '/computers/accessories', icon: <Headphones className="h-4 w-4" />, color: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-500', isActive: true },
    { label: 'قطع الغيار', path: '/computers/spare-parts', icon: <Wrench className="h-4 w-4" />, color: 'bg-orange-600', hoverColor: 'hover:bg-orange-600', isActive: false },
  ],
  companySource: { getItems: getComputers, storageKeys: [STORAGE_KEYS.COMPUTERS] },
  getItems: computerAccessoriesDB.get,
  addItem: computerAccessoriesDB.add,
  updateItem: computerAccessoriesDB.update,
  deleteItem: computerAccessoriesDB.remove,
  exportColumns: COMPUTER_ACCESSORY_COLUMNS,
  exportFileName: 'اكسسوارات_الكمبيوتر',
  excelInventoryType: 'accessory',
  barcodePrefix: 'CAC-',
};

export default function ComputerAccessoriesPage() {
  return <TechSubInventoryPage config={config} />;
}
