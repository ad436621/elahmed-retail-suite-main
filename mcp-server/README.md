# ElAhmed Retail Suite — MCP Server

سيرفر MCP يوفر للذكاء الاصطناعي وصول منظم لبيانات المحل.

## التثبيت

```powershell
cd mcp-server
npm install
```

## الاستخدام

### 1. صدّر نسخة احتياطية من التطبيق
من صفحة الإعدادات → النسخ الاحتياطي → تنزيل نسخة احتياطية

### 2. شغّل السيرفر
```powershell
# حدد مسار ملف الباك أب
$env:BACKUP_FILE_PATH="C:\path\to\GX_Retail_Backup.json"
npx tsx src/index.ts
```

أو حدد مجلد فيه ملفات باك أب (هيستخدم الأحدث تلقائياً):
```powershell
$env:BACKUP_DIR="C:\path\to\backups"
npx tsx src/index.ts
```

## إعداد Claude Desktop

أضف الإعدادات دي في ملف `claude_desktop_config.json`:

**مسار الملف:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**المحتوى:**
```json
{
  "mcpServers": {
    "elahmed-retail": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "e:/مشروعات فاشلة/elahmed-retail-suite-main/mcp-server",
      "env": {
        "BACKUP_FILE_PATH": "C:/path/to/your/backup.json"
      }
    }
  }
}
```

> ⚠️ غيّر `BACKUP_FILE_PATH` لمسار ملف الباك أب الفعلي.

## الأدوات المتاحة (12 أداة)

| الأداة | الوصف |
|--------|-------|
| `get_dashboard_summary` | ملخص شامل: منتجات، مبيعات، أرباح |
| `search_products` | البحث عن منتجات بالاسم أو الباركود |
| `get_product_details` | تفاصيل منتج بالـ ID |
| `get_sales` | المبيعات مع فلتر بالتاريخ |
| `get_customers` | كل العملاء |
| `get_installments` | عقود التقسيط مع فلتر بالحالة |
| `get_expenses` | المصروفات مع فلتر بالتاريخ |
| `get_maintenance_orders` | أوامر الصيانة |
| `get_suppliers` | الموردين |
| `get_inventory_summary` | ملخص المخزون في كل الأقسام |
| `get_low_stock_alerts` | المنتجات قليلة الكمية |
| `get_financial_report` | تقرير مالي شامل لفترة محددة |

## الموارد (Resources)

| المورد | الوصف |
|--------|-------|
| `retail://overview` | نظرة عامة على البيانات |
| `retail://storage-keys` | مفاتيح التخزين المتاحة |

## الاختبار بـ MCP Inspector

```powershell
$env:BACKUP_FILE_PATH="C:\path\to\backup.json"
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```
