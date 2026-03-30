import { useEffect } from 'react';
import { toast } from 'sonner';

export function LocalStorageSizeMonitor(): null {
  useEffect(() => {
    const checkStorageSize = () => {
      try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            if (value) {
              total += key.length + value.length;
            }
          }
        }
        
        // Convert to MB (UTF-16 chars basically take 2 bytes, but here we just estimate)
        // More accurately 1 char = 2 bytes, so:
        const sizeInBytes = total * 2;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        // Warn if more than 4MB (localStorage typically has 5MB limit)
        if (sizeInMB > 4.5) {
          toast.error("تنبيه خطير: مساحة التخزين المحلية ممتلئة تقريباً!", {
            description: `المساحة المستخدمة: ${sizeInMB.toFixed(2)} MB من أصل 5 MB. يرجى أخذ نسخة احتياطية ومسح البيانات القديمة.`,
            duration: 15000,
          });
        } else if (sizeInMB > 4.0) {
          toast.warning("تحذير: مساحة التخزين المحلية توشك على الامتلاء", {
            description: `المساحة المستخدمة: ${sizeInMB.toFixed(2)} MB. يفضل تفريغ بعض البيانات.`,
            duration: 10000,
          });
        }
      } catch (err) {
        console.error("Error calculating localStorage size", err);
      }
    };

    // Check on mount
    checkStorageSize();

    // Check every hour
    const intervalId = setInterval(checkStorageSize, 1000 * 60 * 60);
    
    return () => clearInterval(intervalId);
  }, []);

  return null;
}
