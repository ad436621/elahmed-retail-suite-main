const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src', 'pages');
const sourceFile = path.join(baseDir, 'MobilesInventory.tsx');

let content = fs.readFileSync(sourceFile, 'utf8');

function generatePage(config) {
    let newContent = content;
    
    // Component name and imports
    newContent = newContent.replace(/export default function MobilesInventory/g, `export default function ${config.componentName}`);
    newContent = newContent.replace(/getMobiles, addMobile, updateMobile, deleteMobile/g, `${config.getFn}, ${config.addFn}, ${config.updateFn}, ${config.deleteFn}`);
    newContent = newContent.replace(/useInventoryData\(getMobiles/g, `useInventoryData(${config.getFn}`);
    newContent = newContent.replace(/updateMobile\(/g, `${config.updateFn}(`);
    newContent = newContent.replace(/addMobile\(/g, `${config.addFn}(`);
    newContent = newContent.replace(/deleteMobile\(/g, `${config.deleteFn}(`);
    
    // Types
    newContent = newContent.replace(/MobileItem/g, config.interfaceName);
    
    // Text labels
    newContent = newContent.replace(/إدارة تصنيفات الموبايلات/g, `إدارة تصنيفات ${config.title}`);
    newContent = newContent.replace(/مخزون الموبايلات/g, `مخزون ${config.title}`);
    newContent = newContent.replace(/الأجهزة المتوفرة/g, `الأنواع المتوفرة`);
    
    // Nav buttons highlighting
    if (config.isAccessory) {
        newContent = newContent.replace(/bg-cyan-600 px-5 py-2\.5 text-sm font-bold text-white shadow-md ring-2 ring-cyan-300 ring-offset-1/g, 'bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-cyan-600 hover:text-white transition-all shadow-sm');
        newContent = newContent.replace(/bg-muted px-5 py-2\.5 text-sm font-bold text-muted-foreground hover:bg-cyan-500 hover:text-white transition-all shadow-sm/g, 'bg-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md ring-2 ring-cyan-500 ring-offset-1');
    } else if (config.isSpare) {
        newContent = newContent.replace(/bg-cyan-600 px-5 py-2\.5 text-sm font-bold text-white shadow-md ring-2 ring-cyan-300 ring-offset-1/g, 'bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-cyan-600 hover:text-white transition-all shadow-sm');
        newContent = newContent.replace(/bg-muted px-5 py-2\.5 text-sm font-bold text-muted-foreground hover:bg-orange-600 hover:text-white transition-all shadow-sm/g, 'bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md ring-2 ring-orange-500 ring-offset-1');
    }
    
    fs.writeFileSync(path.join(baseDir, `${config.componentName}.tsx`), newContent);
    console.log(`Generated ${config.componentName}.tsx`);
}

// 1. MobileAccessoriesPage
generatePage({
    componentName: 'MobileAccessoriesPage',
    getFn: 'getMobileAccessories',
    addFn: 'addMobileAccessory',
    updateFn: 'updateMobileAccessory',
    deleteFn: 'deleteMobileAccessory',
    interfaceName: 'MobileAccessory',
    title: 'إكسسوارات الموبايل',
    isAccessory: true,
    isSpare: false
});

// 2. MobileSparePartsPage
generatePage({
    componentName: 'MobileSparePartsPage',
    getFn: 'getMobileSpareParts',
    addFn: 'addMobileSparePart',
    updateFn: 'updateMobileSparePart',
    deleteFn: 'deleteMobileSparePart',
    interfaceName: 'MobileSparePart',
    title: 'قطع غيار الموبايل',
    isAccessory: false,
    isSpare: true
});
