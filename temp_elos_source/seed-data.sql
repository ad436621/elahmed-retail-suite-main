-- seed-data.sql - بيانات تجريبية للداتابيز

-- ═══════════════════════════════════════════════════════════════
-- 1. إضافة 100 جهاز
-- ═══════════════════════════════════════════════════════════════

INSERT INTO devices (type, model, storage, condition, color, imei1, imei2, purchase_cost, expected_price, status, battery_health, has_box, source, notes, created_at) VALUES
-- iPhone
('iPhone', 'iPhone 15 Pro Max', '256GB', 'new', 'أسود', '351234567890123', '351234567890124', 55000, 63000, 'in_stock', 100, 1, 'supplier', 'جهاز 1', datetime('now', 'localtime')),
('iPhone', 'iPhone 15 Pro Max', '512GB', 'new', 'ذهبي', '351234567890125', '351234567890126', 62000, 71000, 'in_stock', 100, 1, 'supplier', 'جهاز 2', datetime('now', 'localtime')),
('iPhone', 'iPhone 15 Pro', '256GB', 'new', 'أزرق', '351234567890127', '351234567890128', 48000, 55000, 'in_stock', 100, 1, 'supplier', 'جهاز 3', datetime('now', 'localtime')),
('iPhone', 'iPhone 15 Pro', '128GB', 'like_new', 'أسود', '351234567890129', '351234567890130', 38000, 44000, 'in_stock', 95, 1, 'supplier', 'جهاز 4', datetime('now', 'localtime')),
('iPhone', 'iPhone 15', '128GB', 'new', 'أزرق', '351234567890131', '351234567890132', 35000, 40000, 'in_stock', 100, 1, 'supplier', 'جهاز 5', datetime('now', 'localtime')),
('iPhone', 'iPhone 15', '256GB', 'new', 'وردي', '351234567890133', '351234567890134', 40000, 46000, 'in_stock', 100, 1, 'supplier', 'جهاز 6', datetime('now', 'localtime')),
('iPhone', 'iPhone 14 Pro Max', '256GB', 'like_new', 'بنفسجي', '351234567890135', '351234567890136', 38000, 44000, 'in_stock', 92, 1, 'supplier', 'جهاز 7', datetime('now', 'localtime')),
('iPhone', 'iPhone 14 Pro Max', '512GB', 'used', 'ذهبي', '351234567890137', '351234567890138', 35000, 40000, 'in_stock', 88, 0, 'supplier', 'جهاز 8', datetime('now', 'localtime')),
('iPhone', 'iPhone 14 Pro', '128GB', 'new', 'أسود', '351234567890139', '351234567890140', 35000, 40000, 'in_stock', 100, 1, 'supplier', 'جهاز 9', datetime('now', 'localtime')),
('iPhone', 'iPhone 14 Pro', '256GB', 'like_new', 'فضي', '351234567890141', '351234567890142', 32000, 37000, 'in_stock', 94, 1, 'supplier', 'جهاز 10', datetime('now', 'localtime')),
('iPhone', 'iPhone 14', '128GB', 'new', 'أزرق', '351234567890143', '351234567890144', 28000, 32000, 'in_stock', 100, 1, 'supplier', 'جهاز 11', datetime('now', 'localtime')),
('iPhone', 'iPhone 14', '256GB', 'used', 'أحمر', '351234567890145', '351234567890146', 23000, 27000, 'in_stock', 89, 0, 'supplier', 'جهاز 12', datetime('now', 'localtime')),
('iPhone', 'iPhone 14 Plus', '128GB', 'new', 'أسود', '351234567890147', '351234567890148', 32000, 37000, 'in_stock', 100, 1, 'supplier', 'جهاز 13', datetime('now', 'localtime')),
('iPhone', 'iPhone 13 Pro Max', '256GB', 'like_new', 'ذهبي', '351234567890149', '351234567890150', 28000, 32000, 'in_stock', 91, 1, 'supplier', 'جهاز 14', datetime('now', 'localtime')),
('iPhone', 'iPhone 13 Pro Max', '512GB', 'used', 'أزرق', '351234567890151', '351234567890152', 26000, 30000, 'in_stock', 87, 0, 'supplier', 'جهاز 15', datetime('now', 'localtime')),
('iPhone', 'iPhone 13 Pro', '128GB', 'new', 'أخضر', '351234567890153', '351234567890154', 24000, 28000, 'in_stock', 100, 1, 'supplier', 'جهاز 16', datetime('now', 'localtime')),
('iPhone', 'iPhone 13 Pro', '256GB', 'like_new', 'رمادي', '351234567890155', '351234567890156', 23000, 27000, 'in_stock', 93, 1, 'supplier', 'جهاز 17', datetime('now', 'localtime')),
('iPhone', 'iPhone 13', '128GB', 'new', 'وردي', '351234567890157', '351234567890158', 18000, 21000, 'in_stock', 100, 1, 'supplier', 'جهاز 18', datetime('now', 'localtime')),
('iPhone', 'iPhone 13', '256GB', 'used', 'أبيض', '351234567890159', '351234567890160', 16000, 19000, 'in_stock', 88, 0, 'supplier', 'جهاز 19', datetime('now', 'localtime')),
('iPhone', 'iPhone 13 Mini', '128GB', 'like_new', 'أحمر', '351234567890161', '351234567890162', 14000, 16000, 'in_stock', 90, 1, 'supplier', 'جهاز 20', datetime('now', 'localtime')),
('iPhone', 'iPhone 12 Pro Max', '256GB', 'used', 'ذهبي', '351234567890163', '351234567890164', 18000, 21000, 'in_stock', 86, 0, 'supplier', 'جهاز 21', datetime('now', 'localtime')),
('iPhone', 'iPhone 12 Pro', '128GB', 'like_new', 'أزرق', '351234567890165', '351234567890166', 15000, 17000, 'in_stock', 89, 1, 'supplier', 'جهاز 22', datetime('now', 'localtime')),
('iPhone', 'iPhone 12', '64GB', 'used', 'أسود', '351234567890167', '351234567890168', 10000, 12000, 'in_stock', 85, 0, 'supplier', 'جهاز 23', datetime('now', 'localtime')),
('iPhone', 'iPhone 12', '128GB', 'faulty', 'أبيض', '351234567890169', '351234567890170', 9000, 11000, 'in_stock', 82, 0, 'supplier', 'جهاز 24', datetime('now', 'localtime')),
('iPhone', 'iPhone 11 Pro Max', '256GB', 'used', 'رمادي', '351234567890171', '351234567890172', 14000, 16000, 'in_stock', 84, 0, 'supplier', 'جهاز 25', datetime('now', 'localtime')),
('iPhone', 'iPhone 11 Pro', '64GB', 'faulty', 'ذهبي', '351234567890173', '351234567890174', 10000, 12000, 'in_stock', 80, 0, 'supplier', 'جهاز 26', datetime('now', 'localtime')),
('iPhone', 'iPhone 11', '64GB', 'used', 'أحمر', '351234567890175', '351234567890176', 8000, 10000, 'in_stock', 83, 0, 'supplier', 'جهاز 27', datetime('now', 'localtime')),
('iPhone', 'iPhone 11', '128GB', 'like_new', 'أسود', '351234567890177', '351234567890178', 9500, 11000, 'in_stock', 88, 1, 'supplier', 'جهاز 28', datetime('now', 'localtime')),
('iPhone', 'iPhone SE 2022', '64GB', 'new', 'أبيض', '351234567890179', '351234567890180', 12000, 14000, 'in_stock', 100, 1, 'supplier', 'جهاز 29', datetime('now', 'localtime')),
('iPhone', 'iPhone SE 2020', '64GB', 'used', 'أسود', '351234567890181', '351234567890182', 6000, 7500, 'in_stock', 85, 0, 'supplier', 'جهاز 30', datetime('now', 'localtime')),
-- Samsung
('Samsung', 'Galaxy S24 Ultra', '256GB', 'new', 'أسود', '351234567890183', '351234567890184', 48000, 55000, 'in_stock', 100, 1, 'supplier', 'جهاز 31', datetime('now', 'localtime')),
('Samsung', 'Galaxy S24 Ultra', '512GB', 'new', 'بنفسجي', '351234567890185', '351234567890186', 55000, 63000, 'in_stock', 100, 1, 'supplier', 'جهاز 32', datetime('now', 'localtime')),
('Samsung', 'Galaxy S24+', '256GB', 'new', 'ذهبي', '351234567890187', '351234567890188', 38000, 44000, 'in_stock', 100, 1, 'supplier', 'جهاز 33', datetime('now', 'localtime')),
('Samsung', 'Galaxy S24', '128GB', 'new', 'أخضر', '351234567890189', '351234567890190', 28000, 32000, 'in_stock', 100, 1, 'supplier', 'جهاز 34', datetime('now', 'localtime')),
('Samsung', 'Galaxy S24', '256GB', 'like_new', 'أسود', '351234567890191', '351234567890192', 26000, 30000, 'in_stock', 95, 1, 'supplier', 'جهاز 35', datetime('now', 'localtime')),
('Samsung', 'Galaxy S23 Ultra', '256GB', 'new', 'أخضر', '351234567890193', '351234567890194', 38000, 44000, 'in_stock', 100, 1, 'supplier', 'جهاز 36', datetime('now', 'localtime')),
('Samsung', 'Galaxy S23 Ultra', '512GB', 'like_new', 'أسود', '351234567890195', '351234567890196', 35000, 40000, 'in_stock', 94, 1, 'supplier', 'جهاز 37', datetime('now', 'localtime')),
('Samsung', 'Galaxy S23+', '256GB', 'used', 'وردي', '351234567890197', '351234567890198', 25000, 29000, 'in_stock', 89, 0, 'supplier', 'جهاز 38', datetime('now', 'localtime')),
('Samsung', 'Galaxy S23', '128GB', 'new', 'أبيض', '351234567890199', '351234567890200', 22000, 25000, 'in_stock', 100, 1, 'supplier', 'جهاز 39', datetime('now', 'localtime')),
('Samsung', 'Galaxy S23', '256GB', 'like_new', 'أسود', '351234567890201', '351234567890202', 20000, 23000, 'in_stock', 93, 1, 'supplier', 'جهاز 40', datetime('now', 'localtime')),
('Samsung', 'Galaxy S22 Ultra', '256GB', 'used', 'أحمر', '351234567890203', '351234567890204', 22000, 25000, 'in_stock', 87, 0, 'supplier', 'جهاز 41', datetime('now', 'localtime')),
('Samsung', 'Galaxy S22+', '128GB', 'like_new', 'أسود', '351234567890205', '351234567890206', 16000, 19000, 'in_stock', 90, 1, 'supplier', 'جهاز 42', datetime('now', 'localtime')),
('Samsung', 'Galaxy S22', '128GB', 'used', 'أخضر', '351234567890207', '351234567890208', 12000, 14000, 'in_stock', 86, 0, 'supplier', 'جهاز 43', datetime('now', 'localtime')),
('Samsung', 'Galaxy S21 Ultra', '256GB', 'faulty', 'فضي', '351234567890209', '351234567890210', 14000, 16000, 'in_stock', 82, 0, 'supplier', 'جهاز 44', datetime('now', 'localtime')),
('Samsung', 'Galaxy S21', '128GB', 'used', 'بنفسجي', '351234567890211', '351234567890212', 8000, 10000, 'in_stock', 85, 0, 'supplier', 'جهاز 45', datetime('now', 'localtime')),
('Samsung', 'Galaxy Z Fold 5', '256GB', 'new', 'أسود', '351234567890213', '351234567890214', 55000, 63000, 'in_stock', 100, 1, 'supplier', 'جهاز 46', datetime('now', 'localtime')),
('Samsung', 'Galaxy Z Fold 5', '512GB', 'like_new', 'أزرق', '351234567890215', '351234567890216', 52000, 60000, 'in_stock', 96, 1, 'supplier', 'جهاز 47', datetime('now', 'localtime')),
('Samsung', 'Galaxy Z Flip 5', '256GB', 'new', 'بنفسجي', '351234567890217', '351234567890218', 35000, 40000, 'in_stock', 100, 1, 'supplier', 'جهاز 48', datetime('now', 'localtime')),
('Samsung', 'Galaxy Z Flip 5', '512GB', 'like_new', 'ذهبي', '351234567890219', '351234567890220', 33000, 38000, 'in_stock', 94, 1, 'supplier', 'جهاز 49', datetime('now', 'localtime')),
('Samsung', 'Galaxy A54', '128GB', 'new', 'أسود', '351234567890221', '351234567890222', 10000, 12000, 'in_stock', 100, 1, 'supplier', 'جهاز 50', datetime('now', 'localtime')),
('Samsung', 'Galaxy A54', '256GB', 'new', 'أبيض', '351234567890223', '351234567890224', 12000, 14000, 'in_stock', 100, 1, 'supplier', 'جهاز 51', datetime('now', 'localtime')),
('Samsung', 'Galaxy A34', '128GB', 'new', 'أخضر', '351234567890225', '351234567890226', 7000, 8500, 'in_stock', 100, 1, 'supplier', 'جهاز 52', datetime('now', 'localtime')),
('Samsung', 'Galaxy A14', '64GB', 'new', 'أسود', '351234567890227', '351234567890228', 4500, 5500, 'in_stock', 100, 1, 'supplier', 'جهاز 53', datetime('now', 'localtime')),
('Samsung', 'Galaxy Note 20 Ultra', '256GB', 'used', 'برونزي', '351234567890229', '351234567890230', 15000, 17500, 'in_stock', 86, 0, 'supplier', 'جهاز 54', datetime('now', 'localtime')),
('Samsung', 'Galaxy Note 20', '256GB', 'faulty', 'رمادي', '351234567890231', '351234567890232', 10000, 12000, 'in_stock', 80, 0, 'supplier', 'جهاز 55', datetime('now', 'localtime')),
-- Xiaomi
('Xiaomi', 'Xiaomi 14 Ultra', '512GB', 'new', 'أسود', '351234567890233', '351234567890234', 35000, 40000, 'in_stock', 100, 1, 'supplier', 'جهاز 56', datetime('now', 'localtime')),
('Xiaomi', 'Xiaomi 14 Pro', '256GB', 'new', 'أبيض', '351234567890235', '351234567890236', 25000, 29000, 'in_stock', 100, 1, 'supplier', 'جهاز 57', datetime('now', 'localtime')),
('Xiaomi', 'Xiaomi 14', '256GB', 'new', 'أخضر', '351234567890237', '351234567890238', 18000, 21000, 'in_stock', 100, 1, 'supplier', 'جهاز 58', datetime('now', 'localtime')),
('Xiaomi', 'Xiaomi 13 Ultra', '512GB', 'like_new', 'أسود', '351234567890239', '351234567890240', 28000, 32000, 'in_stock', 95, 1, 'supplier', 'جهاز 59', datetime('now', 'localtime')),
('Xiaomi', 'Xiaomi 13 Pro', '256GB', 'new', 'أبيض', '351234567890241', '351234567890242', 20000, 23000, 'in_stock', 100, 1, 'supplier', 'جهاز 60', datetime('now', 'localtime')),
('Xiaomi', 'Xiaomi 13', '256GB', 'like_new', 'أزرق', '351234567890243', '351234567890244', 15000, 17500, 'in_stock', 94, 1, 'supplier', 'جهاز 61', datetime('now', 'localtime')),
('Xiaomi', 'Redmi Note 13 Pro+', '256GB', 'new', 'أسود', '351234567890245', '351234567890246', 10000, 12000, 'in_stock', 100, 1, 'supplier', 'جهاز 62', datetime('now', 'localtime')),
('Xiaomi', 'Redmi Note 13 Pro', '256GB', 'new', 'أزرق', '351234567890247', '351234567890248', 8000, 9500, 'in_stock', 100, 1, 'supplier', 'جهاز 63', datetime('now', 'localtime')),
('Xiaomi', 'Redmi Note 13', '128GB', 'new', 'أخضر', '351234567890249', '351234567890250', 5500, 6500, 'in_stock', 100, 1, 'supplier', 'جهاز 64', datetime('now', 'localtime')),
('Xiaomi', 'Redmi Note 12 Pro+', '256GB', 'like_new', 'أسود', '351234567890251', '351234567890252', 7000, 8500, 'in_stock', 93, 1, 'supplier', 'جهاز 65', datetime('now', 'localtime')),
('Xiaomi', 'Redmi Note 12', '128GB', 'used', 'أزرق', '351234567890253', '351234567890254', 4000, 5000, 'in_stock', 88, 0, 'supplier', 'جهاز 66', datetime('now', 'localtime')),
('Xiaomi', 'POCO X6 Pro', '256GB', 'new', 'أسود', '351234567890255', '351234567890256', 10000, 12000, 'in_stock', 100, 1, 'supplier', 'جهاز 67', datetime('now', 'localtime')),
('Xiaomi', 'POCO X5 Pro', '256GB', 'like_new', 'أصفر', '351234567890257', '351234567890258', 7500, 9000, 'in_stock', 94, 1, 'supplier', 'جهاز 68', datetime('now', 'localtime')),
('Xiaomi', 'POCO F5', '256GB', 'new', 'أسود', '351234567890259', '351234567890260', 9000, 11000, 'in_stock', 100, 1, 'supplier', 'جهاز 69', datetime('now', 'localtime')),
-- OPPO
('OPPO', 'Find X7 Ultra', '512GB', 'new', 'أسود', '351234567890261', '351234567890262', 35000, 40000, 'in_stock', 100, 1, 'supplier', 'جهاز 70', datetime('now', 'localtime')),
('OPPO', 'Find X6 Pro', '256GB', 'new', 'أخضر', '351234567890263', '351234567890264', 25000, 29000, 'in_stock', 100, 1, 'supplier', 'جهاز 71', datetime('now', 'localtime')),
('OPPO', 'Reno 11 Pro', '256GB', 'new', 'أزرق', '351234567890265', '351234567890266', 15000, 17500, 'in_stock', 100, 1, 'supplier', 'جهاز 72', datetime('now', 'localtime')),
('OPPO', 'Reno 11', '256GB', 'new', 'رمادي', '351234567890267', '351234567890268', 12000, 14000, 'in_stock', 100, 1, 'supplier', 'جهاز 73', datetime('now', 'localtime')),
('OPPO', 'Reno 10 Pro+', '256GB', 'like_new', 'بنفسجي', '351234567890269', '351234567890270', 12000, 14000, 'in_stock', 94, 1, 'supplier', 'جهاز 74', datetime('now', 'localtime')),
('OPPO', 'A78', '128GB', 'new', 'أسود', '351234567890271', '351234567890272', 6000, 7500, 'in_stock', 100, 1, 'supplier', 'جهاز 75', datetime('now', 'localtime')),
('OPPO', 'A58', '128GB', 'new', 'أخضر', '351234567890273', '351234567890274', 5000, 6000, 'in_stock', 100, 1, 'supplier', 'جهاز 76', datetime('now', 'localtime')),
-- Huawei
('Huawei', 'Mate 60 Pro', '512GB', 'new', 'أسود', '351234567890275', '351234567890276', 40000, 46000, 'in_stock', 100, 1, 'supplier', 'جهاز 77', datetime('now', 'localtime')),
('Huawei', 'Mate 60', '256GB', 'new', 'أخضر', '351234567890277', '351234567890278', 30000, 35000, 'in_stock', 100, 1, 'supplier', 'جهاز 78', datetime('now', 'localtime')),
('Huawei', 'P60 Pro', '256GB', 'new', 'أسود', '351234567890279', '351234567890280', 28000, 32000, 'in_stock', 100, 1, 'supplier', 'جهاز 79', datetime('now', 'localtime')),
('Huawei', 'P60', '256GB', 'like_new', 'أبيض', '351234567890281', '351234567890282', 22000, 25000, 'in_stock', 95, 1, 'supplier', 'جهاز 80', datetime('now', 'localtime')),
('Huawei', 'Nova 12 Pro', '256GB', 'new', 'أسود', '351234567890283', '351234567890284', 15000, 17500, 'in_stock', 100, 1, 'supplier', 'جهاز 81', datetime('now', 'localtime')),
('Huawei', 'Nova 12', '256GB', 'new', 'أخضر', '351234567890285', '351234567890286', 12000, 14000, 'in_stock', 100, 1, 'supplier', 'جهاز 82', datetime('now', 'localtime')),
-- Realme
('Realme', 'GT 5 Pro', '256GB', 'new', 'أسود', '351234567890287', '351234567890288', 18000, 21000, 'in_stock', 100, 1, 'supplier', 'جهاز 83', datetime('now', 'localtime')),
('Realme', 'GT Neo 5', '256GB', 'new', 'أزرق', '351234567890289', '351234567890290', 12000, 14000, 'in_stock', 100, 1, 'supplier', 'جهاز 84', datetime('now', 'localtime')),
('Realme', '12 Pro+', '256GB', 'new', 'أخضر', '351234567890291', '351234567890292', 10000, 12000, 'in_stock', 100, 1, 'supplier', 'جهاز 85', datetime('now', 'localtime')),
('Realme', '12 Pro', '256GB', 'new', 'ذهبي', '351234567890293', '351234567890294', 8000, 9500, 'in_stock', 100, 1, 'supplier', 'جهاز 86', datetime('now', 'localtime')),
('Realme', 'C55', '128GB', 'new', 'أسود', '351234567890295', '351234567890296', 4500, 5500, 'in_stock', 100, 1, 'supplier', 'جهاز 87', datetime('now', 'localtime')),
-- Vivo
('Vivo', 'X100 Pro', '256GB', 'new', 'أسود', '351234567890297', '351234567890298', 28000, 32000, 'in_stock', 100, 1, 'supplier', 'جهاز 88', datetime('now', 'localtime')),
('Vivo', 'X100', '256GB', 'new', 'أزرق', '351234567890299', '351234567890300', 22000, 25000, 'in_stock', 100, 1, 'supplier', 'جهاز 89', datetime('now', 'localtime')),
('Vivo', 'V30 Pro', '256GB', 'new', 'أسود', '351234567890301', '351234567890302', 16000, 19000, 'in_stock', 100, 1, 'supplier', 'جهاز 90', datetime('now', 'localtime')),
('Vivo', 'V30', '256GB', 'new', 'بنفسجي', '351234567890303', '351234567890304', 13000, 15000, 'in_stock', 100, 1, 'supplier', 'جهاز 91', datetime('now', 'localtime')),
('Vivo', 'Y36', '128GB', 'new', 'ذهبي', '351234567890305', '351234567890306', 5000, 6000, 'in_stock', 100, 1, 'supplier', 'جهاز 92', datetime('now', 'localtime')),
-- OnePlus
('OnePlus', '12', '256GB', 'new', 'أسود', '351234567890307', '351234567890308', 28000, 32000, 'in_stock', 100, 1, 'supplier', 'جهاز 93', datetime('now', 'localtime')),
('OnePlus', '12R', '256GB', 'new', 'أزرق', '351234567890309', '351234567890310', 18000, 21000, 'in_stock', 100, 1, 'supplier', 'جهاز 94', datetime('now', 'localtime')),
('OnePlus', 'Nord 3', '256GB', 'new', 'أخضر', '351234567890311', '351234567890312', 12000, 14000, 'in_stock', 100, 1, 'supplier', 'جهاز 95', datetime('now', 'localtime')),
('OnePlus', 'Nord CE 3', '128GB', 'like_new', 'رمادي', '351234567890313', '351234567890314', 8000, 9500, 'in_stock', 94, 1, 'supplier', 'جهاز 96', datetime('now', 'localtime')),
-- Google
('Google', 'Pixel 8 Pro', '256GB', 'new', 'أسود', '351234567890315', '351234567890316', 30000, 35000, 'in_stock', 100, 1, 'supplier', 'جهاز 97', datetime('now', 'localtime')),
('Google', 'Pixel 8', '128GB', 'new', 'أزرق', '351234567890317', '351234567890318', 22000, 25000, 'in_stock', 100, 1, 'supplier', 'جهاز 98', datetime('now', 'localtime')),
('Google', 'Pixel 7 Pro', '256GB', 'like_new', 'أبيض', '351234567890319', '351234567890320', 20000, 23000, 'in_stock', 93, 1, 'supplier', 'جهاز 99', datetime('now', 'localtime')),
('Google', 'Pixel 7a', '128GB', 'new', 'رمادي', '351234567890321', '351234567890322', 12000, 14000, 'in_stock', 100, 1, 'supplier', 'جهاز 100', datetime('now', 'localtime'));


-- ═══════════════════════════════════════════════════════════════
-- 2. إضافة الإكسسوارات (أصناف + كميات = 1000+ قطعة)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO accessories (warehouse_id, name, category, sku, barcode, purchase_price, sale_price, quantity, min_stock, created_at) VALUES
-- شواحن
(2, 'شاحن أصلي Apple 20W', 'شواحن', 'ACC-0001', '6901234560001', 350, 450, 25, 3, datetime('now', 'localtime')),
(2, 'شاحن Samsung 25W أصلي', 'شواحن', 'ACC-0002', '6901234560002', 300, 400, 25, 3, datetime('now', 'localtime')),
(2, 'شاحن سريع 65W GaN', 'شواحن', 'ACC-0003', '6901234560003', 450, 600, 20, 3, datetime('now', 'localtime')),
(2, 'شاحن لاسلكي MagSafe', 'شواحن', 'ACC-0004', '6901234560004', 400, 550, 15, 3, datetime('now', 'localtime')),
(2, 'شاحن سيارة سريع 45W', 'شواحن', 'ACC-0005', '6901234560005', 200, 280, 30, 3, datetime('now', 'localtime')),
(2, 'شاحن متعدد المنافذ 100W', 'شواحن', 'ACC-0006', '6901234560006', 600, 800, 15, 3, datetime('now', 'localtime')),
(2, 'كابل Lightning أصلي 1م', 'شواحن', 'ACC-0007', '6901234560007', 150, 220, 40, 5, datetime('now', 'localtime')),
(2, 'كابل Lightning أصلي 2م', 'شواحن', 'ACC-0008', '6901234560008', 200, 280, 30, 5, datetime('now', 'localtime')),
(2, 'كابل Type-C to Type-C', 'شواحن', 'ACC-0009', '6901234560009', 120, 180, 40, 5, datetime('now', 'localtime')),
(2, 'كابل Type-C to Lightning', 'شواحن', 'ACC-0010', '6901234560010', 180, 260, 35, 5, datetime('now', 'localtime')),
-- سماعات
(2, 'AirPods Pro 2', 'سماعات', 'ACC-0011', '6901234560011', 6000, 7500, 10, 2, datetime('now', 'localtime')),
(2, 'AirPods 3', 'سماعات', 'ACC-0012', '6901234560012', 4000, 5200, 12, 2, datetime('now', 'localtime')),
(2, 'AirPods 2', 'سماعات', 'ACC-0013', '6901234560013', 2500, 3300, 15, 2, datetime('now', 'localtime')),
(2, 'Galaxy Buds 2 Pro', 'سماعات', 'ACC-0014', '6901234560014', 3500, 4500, 10, 2, datetime('now', 'localtime')),
(2, 'Galaxy Buds FE', 'سماعات', 'ACC-0015', '6901234560015', 2000, 2600, 15, 2, datetime('now', 'localtime')),
(2, 'سماعة JBL Tune 510BT', 'سماعات', 'ACC-0016', '6901234560016', 800, 1100, 20, 3, datetime('now', 'localtime')),
(2, 'سماعة JBL Tune 760NC', 'سماعات', 'ACC-0017', '6901234560017', 1500, 2000, 12, 3, datetime('now', 'localtime')),
(2, 'EarPods Lightning أصلي', 'سماعات', 'ACC-0018', '6901234560018', 400, 550, 25, 3, datetime('now', 'localtime')),
(2, 'سماعة gaming سلكية', 'سماعات', 'ACC-0019', '6901234560019', 300, 420, 20, 3, datetime('now', 'localtime')),
-- جرابات iPhone
(2, 'جراب سيليكون iPhone 15 Pro Max', 'جرابات', 'ACC-0020', '6901234560020', 80, 150, 30, 5, datetime('now', 'localtime')),
(2, 'جراب سيليكون iPhone 15 Pro', 'جرابات', 'ACC-0021', '6901234560021', 80, 150, 30, 5, datetime('now', 'localtime')),
(2, 'جراب سيليكون iPhone 15', 'جرابات', 'ACC-0022', '6901234560022', 70, 130, 30, 5, datetime('now', 'localtime')),
(2, 'جراب سيليكون iPhone 14 Pro Max', 'جرابات', 'ACC-0023', '6901234560023', 70, 130, 25, 5, datetime('now', 'localtime')),
(2, 'جراب سيليكون iPhone 14 Pro', 'جرابات', 'ACC-0024', '6901234560024', 70, 130, 25, 5, datetime('now', 'localtime')),
(2, 'جراب شفاف iPhone 15 Pro Max', 'جرابات', 'ACC-0025', '6901234560025', 50, 100, 35, 5, datetime('now', 'localtime')),
(2, 'جراب شفاف iPhone 15 Pro', 'جرابات', 'ACC-0026', '6901234560026', 50, 100, 35, 5, datetime('now', 'localtime')),
(2, 'جراب MagSafe iPhone 15', 'جرابات', 'ACC-0027', '6901234560027', 150, 250, 20, 3, datetime('now', 'localtime')),
(2, 'جراب ضد الصدمات iPhone', 'جرابات', 'ACC-0028', '6901234560028', 100, 180, 25, 5, datetime('now', 'localtime')),
(2, 'جراب محفظة جلد iPhone', 'جرابات', 'ACC-0029', '6901234560029', 200, 320, 15, 3, datetime('now', 'localtime')),
-- جرابات Samsung
(2, 'جراب Samsung S24 Ultra أصلي', 'جرابات', 'ACC-0030', '6901234560030', 120, 200, 20, 3, datetime('now', 'localtime')),
(2, 'جراب Samsung S24+ شفاف', 'جرابات', 'ACC-0031', '6901234560031', 60, 120, 25, 5, datetime('now', 'localtime')),
(2, 'جراب Samsung S23 Ultra', 'جرابات', 'ACC-0032', '6901234560032', 100, 170, 20, 3, datetime('now', 'localtime')),
(2, 'جراب Samsung A54 سيليكون', 'جرابات', 'ACC-0033', '6901234560033', 50, 100, 30, 5, datetime('now', 'localtime')),
(2, 'جراب Samsung Z Fold 5', 'جرابات', 'ACC-0034', '6901234560034', 200, 350, 10, 2, datetime('now', 'localtime')),
(2, 'جراب Samsung Z Flip 5', 'جرابات', 'ACC-0035', '6901234560035', 180, 300, 10, 2, datetime('now', 'localtime')),
-- اسكرينات
(2, 'اسكرينة زجاج iPhone 15 Pro Max', 'اسكرينات', 'ACC-0036', '6901234560036', 40, 80, 40, 5, datetime('now', 'localtime')),
(2, 'اسكرينة زجاج iPhone 15 Pro', 'اسكرينات', 'ACC-0037', '6901234560037', 40, 80, 40, 5, datetime('now', 'localtime')),
(2, 'اسكرينة زجاج iPhone 15', 'اسكرينات', 'ACC-0038', '6901234560038', 35, 70, 40, 5, datetime('now', 'localtime')),
(2, 'اسكرينة privacy iPhone 15 Pro Max', 'اسكرينات', 'ACC-0039', '6901234560039', 60, 120, 25, 3, datetime('now', 'localtime')),
(2, 'اسكرينة privacy iPhone 15 Pro', 'اسكرينات', 'ACC-0040', '6901234560040', 60, 120, 25, 3, datetime('now', 'localtime')),
(2, 'اسكرينة سيراميك iPhone', 'اسكرينات', 'ACC-0041', '6901234560041', 50, 100, 30, 5, datetime('now', 'localtime')),
(2, 'اسكرينة Samsung S24 Ultra UV', 'اسكرينات', 'ACC-0042', '6901234560042', 80, 150, 20, 3, datetime('now', 'localtime')),
(2, 'اسكرينة Samsung S24+ Full Glue', 'اسكرينات', 'ACC-0043', '6901234560043', 50, 100, 25, 3, datetime('now', 'localtime')),
(2, 'اسكرينة Samsung A54', 'اسكرينات', 'ACC-0044', '6901234560044', 30, 60, 35, 5, datetime('now', 'localtime')),
-- باور بانك
(2, 'باور بانك Anker 10000mAh', 'باور بانك', 'ACC-0045', '6901234560045', 400, 550, 15, 3, datetime('now', 'localtime')),
(2, 'باور بانك Anker 20000mAh', 'باور بانك', 'ACC-0046', '6901234560046', 600, 800, 12, 3, datetime('now', 'localtime')),
(2, 'باور بانك Anker 26800mAh', 'باور بانك', 'ACC-0047', '6901234560047', 800, 1050, 10, 2, datetime('now', 'localtime')),
(2, 'باور بانك Samsung 10000mAh', 'باور بانك', 'ACC-0048', '6901234560048', 450, 600, 15, 3, datetime('now', 'localtime')),
(2, 'باور بانك MagSafe 5000mAh', 'باور بانك', 'ACC-0049', '6901234560049', 500, 700, 12, 3, datetime('now', 'localtime')),
(2, 'باور بانك سريع 65W 20000mAh', 'باور بانك', 'ACC-0050', '6901234560050', 700, 950, 10, 2, datetime('now', 'localtime')),
(2, 'باور بانك صغير 5000mAh', 'باور بانك', 'ACC-0051', '6901234560051', 200, 300, 20, 5, datetime('now', 'localtime')),
-- حوامل
(2, 'حامل سيارة مغناطيسي', 'حوامل', 'ACC-0052', '6901234560052', 80, 150, 25, 5, datetime('now', 'localtime')),
(2, 'حامل MagSafe للسيارة', 'حوامل', 'ACC-0053', '6901234560053', 200, 320, 15, 3, datetime('now', 'localtime')),
(2, 'حامل مكتب قابل للتعديل', 'حوامل', 'ACC-0054', '6901234560054', 100, 180, 20, 3, datetime('now', 'localtime')),
(2, 'حامل ring للموبايل', 'حوامل', 'ACC-0055', '6901234560055', 30, 60, 40, 5, datetime('now', 'localtime')),
(2, 'PopSocket أصلي', 'حوامل', 'ACC-0056', '6901234560056', 80, 150, 30, 5, datetime('now', 'localtime')),
(2, 'حامل تابلت للمكتب', 'حوامل', 'ACC-0057', '6901234560057', 150, 250, 15, 3, datetime('now', 'localtime')),
-- ساعات ذكية
(2, 'Apple Watch SE 2nd Gen 40mm', 'ساعات ذكية', 'ACC-0058', '6901234560058', 8000, 10000, 5, 1, datetime('now', 'localtime')),
(2, 'Apple Watch SE 2nd Gen 44mm', 'ساعات ذكية', 'ACC-0059', '6901234560059', 9000, 11000, 5, 1, datetime('now', 'localtime')),
(2, 'Apple Watch Series 9 41mm', 'ساعات ذكية', 'ACC-0060', '6901234560060', 14000, 17000, 4, 1, datetime('now', 'localtime')),
(2, 'Apple Watch Series 9 45mm', 'ساعات ذكية', 'ACC-0061', '6901234560061', 15000, 18000, 4, 1, datetime('now', 'localtime')),
(2, 'Apple Watch Ultra 2', 'ساعات ذكية', 'ACC-0062', '6901234560062', 28000, 33000, 2, 1, datetime('now', 'localtime')),
(2, 'Galaxy Watch 6 40mm', 'ساعات ذكية', 'ACC-0063', '6901234560063', 7000, 9000, 5, 1, datetime('now', 'localtime')),
(2, 'Galaxy Watch 6 44mm', 'ساعات ذكية', 'ACC-0064', '6901234560064', 8000, 10000, 5, 1, datetime('now', 'localtime')),
(2, 'Galaxy Watch 6 Classic 43mm', 'ساعات ذكية', 'ACC-0065', '6901234560065', 10000, 12500, 4, 1, datetime('now', 'localtime')),
(2, 'سوار ساعة Apple سيليكون', 'ساعات ذكية', 'ACC-0066', '6901234560066', 100, 180, 30, 5, datetime('now', 'localtime')),
(2, 'سوار ساعة Apple معدن', 'ساعات ذكية', 'ACC-0067', '6901234560067', 200, 350, 20, 3, datetime('now', 'localtime')),
(2, 'سوار ساعة Samsung', 'ساعات ذكية', 'ACC-0068', '6901234560068', 80, 150, 25, 5, datetime('now', 'localtime')),
-- أخرى
(2, 'AirTag Apple', 'أخرى', 'ACC-0069', '6901234560069', 900, 1200, 15, 3, datetime('now', 'localtime')),
(2, 'AirTag 4 Pack', 'أخرى', 'ACC-0070', '6901234560070', 3000, 3800, 8, 2, datetime('now', 'localtime')),
(2, 'Apple Pencil 2nd Gen', 'أخرى', 'ACC-0071', '6901234560071', 3500, 4500, 6, 2, datetime('now', 'localtime')),
(2, 'Apple Pencil USB-C', 'أخرى', 'ACC-0072', '6901234560072', 2500, 3200, 8, 2, datetime('now', 'localtime')),
(2, 'Samsung S Pen', 'أخرى', 'ACC-0073', '6901234560073', 1500, 2000, 8, 2, datetime('now', 'localtime')),
(2, 'ميموري كارد 128GB سريعة', 'أخرى', 'ACC-0074', '6901234560074', 200, 300, 25, 5, datetime('now', 'localtime')),
(2, 'ميموري كارد 256GB سريعة', 'أخرى', 'ACC-0075', '6901234560075', 350, 500, 20, 5, datetime('now', 'localtime')),
(2, 'ميموري كارد 512GB', 'أخرى', 'ACC-0076', '6901234560076', 600, 800, 10, 3, datetime('now', 'localtime')),
(2, 'قارئ كروت USB-C', 'أخرى', 'ACC-0077', '6901234560077', 100, 180, 20, 5, datetime('now', 'localtime')),
(2, 'محول OTG Type-C', 'أخرى', 'ACC-0078', '6901234560078', 50, 100, 30, 5, datetime('now', 'localtime')),
(2, 'Hub USB-C 7 in 1', 'أخرى', 'ACC-0079', '6901234560079', 400, 600, 12, 3, datetime('now', 'localtime')),
(2, 'محول Lightning to 3.5mm', 'أخرى', 'ACC-0080', '6901234560080', 80, 150, 25, 5, datetime('now', 'localtime'));


-- ═══════════════════════════════════════════════════════════════
-- 3. إضافة 10 عملاء
-- ═══════════════════════════════════════════════════════════════

INSERT INTO clients (name, phone, address, balance, notes, created_at) VALUES
('أحمد محمد علي', '01012345678', 'القاهرة - مدينة نصر', 0, 'عميل جديد', datetime('now', 'localtime')),
('محمود سعيد حسن', '01098765432', 'الجيزة - الدقي', 0, 'عميل جديد', datetime('now', 'localtime')),
('كريم أشرف عبدالله', '01123456789', 'الإسكندرية - سموحة', 0, 'عميل جديد', datetime('now', 'localtime')),
('يوسف إبراهيم محمد', '01234567890', 'المنصورة - شارع الجمهورية', 0, 'عميل جديد', datetime('now', 'localtime')),
('عمر خالد أحمد', '01512345678', 'طنطا - شارع سعيد', 0, 'عميل جديد', datetime('now', 'localtime')),
('مصطفى أحمد حسين', '01098123456', 'أسيوط - شارع الجلاء', 0, 'عميل جديد', datetime('now', 'localtime')),
('حسام عادل محمود', '01156789012', 'سوهاج - شارع الجيش', 0, 'عميل جديد', datetime('now', 'localtime')),
('طارق سمير عبدالحميد', '01278901234', 'الفيوم - شارع النيل', 0, 'عميل جديد', datetime('now', 'localtime')),
('هشام محمود علي', '01089012345', 'بني سويف - شارع صلاح سالم', 0, 'عميل جديد', datetime('now', 'localtime')),
('وليد عبدالرحمن سيد', '01190123456', 'المنيا - شارع كورنيش النيل', 0, 'عميل جديد', datetime('now', 'localtime'));


-- ═══════════════════════════════════════════════════════════════
-- 4. إضافة 10 موردين
-- ═══════════════════════════════════════════════════════════════

INSERT INTO suppliers (name, phone, address, balance, notes, created_at) VALUES
('شركة النيل للموبايلات', '01200000001', 'القاهرة - وسط البلد - عمارة النيل', 0, 'مورد أجهزة', datetime('now', 'localtime')),
('مؤسسة الفجر للإلكترونيات', '01200000002', 'القاهرة - العتبة - شارع الأزهر', 0, 'مورد إكسسوارات', datetime('now', 'localtime')),
('الشركة العربية للهواتف', '01200000003', 'الجيزة - الهرم - شارع فيصل', 0, 'مورد أجهزة Samsung', datetime('now', 'localtime')),
('مركز التقنية الحديثة', '01200000004', 'القاهرة - مدينة نصر - عباس العقاد', 0, 'مورد iPhone', datetime('now', 'localtime')),
('شركة الأهرام للاتصالات', '01200000005', 'الإسكندرية - المنشية', 0, 'مورد متنوع', datetime('now', 'localtime')),
('مؤسسة الخليج للإكسسوارات', '01200000006', 'القاهرة - الموسكي', 0, 'مورد إكسسوارات بالجملة', datetime('now', 'localtime')),
('شركة المستقبل للتكنولوجيا', '01200000007', 'القاهرة - المعادي - شارع 9', 0, 'مورد أجهزة Xiaomi', datetime('now', 'localtime')),
('مركز النور للجوالات', '01200000008', 'الجيزة - 6 أكتوبر - المحور', 0, 'مورد متنوع', datetime('now', 'localtime')),
('شركة الوادي للإلكترونيات', '01200000009', 'أسيوط - شارع الجمهورية', 0, 'مورد إقليمي', datetime('now', 'localtime')),
('مؤسسة السلام للهواتف', '01200000010', 'المنصورة - شارع قناة السويس', 0, 'مورد إقليمي', datetime('now', 'localtime'));


-- ═══════════════════════════════════════════════════════════════
-- 5. إضافة رأس المال (100,000 لكل محفظة)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO safe_transactions (type, sub_type, amount, category, description, payment_method, wallet_type, affects_capital, affects_profit, created_by, created_at) VALUES
('deposit', 'opening_balance', 100000, 'رأس مال', 'رأس مال افتتاحي - محفظة الكاش', 'cash', 'cash', 1, 0, 'admin', datetime('now', 'localtime')),
('deposit', 'opening_balance', 100000, 'رأس مال', 'رأس مال افتتاحي - المحفظة الإلكترونية', 'cash', 'mobile_wallet', 1, 0, 'admin', datetime('now', 'localtime')),
('deposit', 'opening_balance', 100000, 'رأس مال', 'رأس مال افتتاحي - الحساب البنكي', 'cash', 'bank', 1, 0, 'admin', datetime('now', 'localtime'));


-- ═══════════════════════════════════════════════════════════════
-- 6. إضافة شريك بنسبة 10% وإيداع 100,000
-- ═══════════════════════════════════════════════════════════════

INSERT INTO partners (name, phone, share_percentage, investment_amount, profit_share_devices, profit_share_accessories, partnership_type, status, notes, created_at) VALUES
('محمد أحمد الشريك', '01012345678', 10, 100000, 10, 10, 'both', 'active', 'شريك بنسبة 10% من رأس المال', datetime('now', 'localtime'));

-- إيداع الشريك في الخزينة (الكاش)
INSERT INTO safe_transactions (type, sub_type, amount, category, description, payment_method, wallet_type, affects_capital, affects_profit, created_by, created_at) VALUES
('deposit', 'partner_investment', 100000, 'استثمار شريك', 'إيداع شريك - محمد أحمد الشريك (10%)', 'cash', 'cash', 1, 0, 'admin', datetime('now', 'localtime'));

-- تسجيل معاملة الشريك
INSERT INTO partner_transactions (partner_id, type, amount, description, created_at) VALUES
(1, 'investment', 100000, 'إيداع رأس مال الشريك', datetime('now', 'localtime'));
