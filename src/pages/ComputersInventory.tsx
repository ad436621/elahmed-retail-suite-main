// ============================================================
// ComputersInventory — thin wrapper over SharedInventoryPage
// All logic lives in @/components/SharedInventoryPage
// ============================================================
import { Laptop } from 'lucide-react';
import SharedInventoryPage, { SharedInventoryConfig } from '@/components/SharedInventoryPage';
import {
    getComputers, addComputer, updateComputer, deleteComputer,
} from '@/data/computersData';
import { ComputerItem, ComputerDeviceType } from '@/domain/types';
import { COMPUTER_COLUMNS } from '@/services/excelService';

const config: SharedInventoryConfig = {
    icon: <Laptop className="h-5 w-5" />,
    title: 'الكمبيوترات',
    categoryStorageKey: 'computers_cats',
    accentColor: 'indigo',
    excelInventoryType: 'computer',
    navSection: 'computers',

    getDevices: getComputers as unknown as SharedInventoryConfig['getDevices'],
    addDevice: addComputer,
    updateDevice: updateComputer,
    deleteDevice: deleteComputer,
    deviceStorageKey: 'gx_computers_v2',

    exportColumns: COMPUTER_COLUMNS,
    exportFileName: 'الكمبيوترات',

    extraDeviceField: {
        key: 'processor',
        label: 'المعالج (Processor)',
        searchable: true,
    },

    buildDeviceFromExcelRow: (row) => {
        const computer: Omit<ComputerItem, 'id' | 'createdAt' | 'updatedAt'> = {
            name: (row.name as string) || '',
            model: (row.model as string) || '',
            barcode: (row.barcode as string) || '',
            deviceType: (row.deviceType as ComputerDeviceType) || 'computer',
            category: (row.category as string) || '',
            condition: (row.condition as 'new' | 'used') || 'new',
            color: (row.color as string) || '',
            quantity: Number(row.quantity) || 0,
            processor: (row.processor as string) || '',
            oldCostPrice: Number(row.oldCostPrice) || 0,
            newCostPrice: Number(row.newCostPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            notes: (row.notes as string) || '',
            description: (row.description as string) || '',
        };
        addComputer(computer);
    },
};

export default function ComputersInventory() {
    return <SharedInventoryPage config={config} />;
}
