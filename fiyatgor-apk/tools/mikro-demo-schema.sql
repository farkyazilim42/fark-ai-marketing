-- Test/demo amaçlı, Mikro v17 tablolarının yalnızca Fiyat Gör'ün okuduğu kolonlarını içeren
-- küçük bir veritabanı. Gerçek Mikro veritabanına UYGULAMAYIN.
IF DB_ID('MikroDB_V17_DEMO') IS NULL CREATE DATABASE MikroDB_V17_DEMO;
GO
USE MikroDB_V17_DEMO;
GO
CREATE TABLE dbo.STOKLAR (
    sto_RECno int IDENTITY PRIMARY KEY,
    sto_iptal bit NOT NULL DEFAULT 0,
    sto_kod nvarchar(25) NOT NULL UNIQUE,
    sto_isim nvarchar(127) NOT NULL,
    sto_kisa_ismi nvarchar(127) NULL,
    sto_birim1_ad nvarchar(10) NULL,
    sto_birim2_ad nvarchar(10) NULL,
    sto_birim3_ad nvarchar(10) NULL,
    sto_birim4_ad nvarchar(10) NULL,
    sto_perakende_vergi tinyint NOT NULL DEFAULT 4
);
CREATE TABLE dbo.BARKOD_TANIMLARI (
    bar_RECno int IDENTITY PRIMARY KEY,
    bar_iptal bit NOT NULL DEFAULT 0,
    bar_kodu nvarchar(50) NOT NULL,
    bar_stokkodu nvarchar(25) NOT NULL,
    bar_birimpntr tinyint NOT NULL DEFAULT 1
);
CREATE TABLE dbo.STOK_SATIS_FIYAT_LISTE_TANIMLARI (
    sfl_RECno int IDENTITY PRIMARY KEY,
    sfl_iptal bit NOT NULL DEFAULT 0,
    sfl_sirano int NOT NULL,
    sfl_aciklama nvarchar(50) NULL,
    sfl_kdvdahil bit NOT NULL DEFAULT 0
);
CREATE TABLE dbo.STOK_SATIS_FIYAT_LISTELERI (
    sfiyat_RECno int IDENTITY PRIMARY KEY,
    sfiyat_iptal bit NOT NULL DEFAULT 0,
    sfiyat_stokkod nvarchar(25) NOT NULL,
    sfiyat_listesirano int NOT NULL,
    sfiyat_deposirano int NOT NULL DEFAULT 0,
    sfiyat_odemeplan int NOT NULL DEFAULT 0,
    sfiyat_birim_pntr tinyint NOT NULL DEFAULT 1,
    sfiyat_fiyati float NOT NULL,
    sfiyat_doviz tinyint NOT NULL DEFAULT 0
);
GO
-- Mikro'daki vergi sıra no -> yüzde fonksiyonunun basit karşılığı (4 = %20, 2 = %10, 1 = %1).
CREATE FUNCTION dbo.fn_VergiYuzde (@sira tinyint) RETURNS float AS
BEGIN
    RETURN CASE @sira WHEN 1 THEN 1 WHEN 2 THEN 10 WHEN 3 THEN 18 WHEN 4 THEN 20 ELSE 0 END
END
GO
INSERT INTO dbo.STOK_SATIS_FIYAT_LISTE_TANIMLARI (sfl_sirano, sfl_aciklama, sfl_kdvdahil) VALUES
 (1, N'Perakende Satış', 1),
 (2, N'Toptan (KDV hariç)', 0);

INSERT INTO dbo.STOKLAR (sto_kod, sto_isim, sto_kisa_ismi, sto_birim1_ad, sto_birim2_ad, sto_perakende_vergi) VALUES
 (N'ST001', N'Çaykur Rize Turist Çayı 1000 g', NULL, N'ADET', N'KOLI', 2),
 (N'ST002', N'Sütaş Tam Yağlı Süt 1 L', N'Homojenize • %3.5 Yağ • Tetrapak Ambalaj', N'ADET', N'KOLI', 2),
 (N'ST003', N'Şölen Ozmo Fındıklı Gofret 30 g', N'Şölen Ozmo Fındıklı Gofret 30 g', N'ADET', N'KOLI', 2),
 (N'ST004', N'Arçelik Çay Makinesi Çaysever', NULL, N'ADET', NULL, 4);

INSERT INTO dbo.BARKOD_TANIMLARI (bar_kodu, bar_stokkodu, bar_birimpntr) VALUES
 (N'8690001000011', N'ST001', 1),
 (N'8690002000028', N'ST002', 1),
 (N'18690002000025', N'ST002', 2),
 (N'8690003000035', N'ST003', 1),
 (N'8690004000042', N'ST004', 1);

INSERT INTO dbo.STOK_SATIS_FIYAT_LISTELERI (sfiyat_stokkod, sfiyat_listesirano, sfiyat_deposirano, sfiyat_birim_pntr, sfiyat_fiyati) VALUES
 (N'ST001', 1, 0, 1, 289.90),
 (N'ST002', 1, 0, 1, 42.50),
 (N'ST002', 1, 0, 2, 480.00),
 (N'ST002', 1, 2, 1, 39.90),
 (N'ST003', 1, 0, 1, 12.75),
 (N'ST004', 1, 0, 1, 2499.00),
 (N'ST001', 2, 0, 1, 245.00);
GO
-- Önerilen salt okunur kullanıcı.
IF SUSER_ID('fiyatgor') IS NULL CREATE LOGIN fiyatgor WITH PASSWORD = 'Fiyat_Okur_2026', CHECK_POLICY = OFF;
GO
CREATE USER fiyatgor FOR LOGIN fiyatgor;
ALTER ROLE db_datareader ADD MEMBER fiyatgor;
GRANT EXECUTE ON dbo.fn_VergiYuzde TO fiyatgor;
GO
