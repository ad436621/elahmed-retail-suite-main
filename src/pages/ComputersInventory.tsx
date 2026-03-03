// ============================================================
// ComputersInventory — thin wrapper over SharedInventoryPage
// All logic lives in @/components/SharedInventoryPage
// ============================================================
import { Laptop } from 'lucide-react';
import SharedInventoryPage, { SharedInventoryConfig } from '@/components/SharedInventoryPage';
import {
    getComputers, addComputer, updateComputer, deleteComputer,
    getComputerAccessories, addComputerAccessory, updateComputerAccessory, deleteComputerAccessory,
} from '@/data/computersData';
import { ComputerItem } from '@/domain/types';

const config: SharedInventoryConfig = {
    icon: <Laptop className="h-5 w-5" />,
    title: 'كمبيوتر وإكسسوارات',
    categorySection: 'computer',
    accentColor: 'indigo',
    excelInventoryType: 'computer',

    getDevices: getComputers,
    addDevice: addComputer,
    updateDevice: updateComputer,
    deleteDevice: deleteComputer,
    deviceStorageKey: 'gx_computers_v2',

    getAccessories: getComputerAccessories,
    addAccessory: addComputerAccessory,
    updateAccessory: updateComputerAccessory,
    deleteAccessory: deleteComputerAccessory,
    accessoryStorageKey: 'gx_computer_accessories',

    extraDeviceField: {
        key: 'processor',
        label: 'المعالج (Processor)',
        searchable: true,
    },

    buildDeviceFromExcelRow: (row) => {
        const computer: Omit<ComputerItem, 'id' | 'createdAt' | 'updatedAt'> = {
            name: row.name || '',
            model: row.model || '',
            barcode: row.barcode || '',
            deviceType: row.deviceType || 'computer',
            category: row.category || '',
            condition: row.condition || 'new',
            color: row.color || '',
            quantity: Number(row.quantity) || 0,
            processor: row.processor || '',
            oldCostPrice: Number(row.oldCostPrice) || 0,
            newCostPrice: Number(row.newCostPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            notes: row.notes || '',
            description: row.description || '',
        };
        addComputer(computer);
    },
};

export default function ComputersInventory() {
    return <SharedInventoryPage config={config} />;
}
