-- Brand-aware product title casing.
--
-- The original products_titlecase_name() (20260607093218) upper-cased the first
-- letter of every word and lower-cased the rest. That mechanically turns
-- "iPhone" into "Iphone" and "256GB" into "256gb" - exactly the product-title
-- defect a competitor audit flagged on the live iPhone listing ("Apple Iphone
-- 17 Unlocked (256gb)").
--
-- The dictionary below maps the brand and unit spellings that must survive
-- title-casing (applied case-insensitively to each whitespace-delimited word),
-- plus two digit+unit patterns (256GB, 48MP, 5000mAh, 1.5TB) that are common in
-- marketplace listings. Everything else keeps the original title-case behaviour.
CREATE OR REPLACE FUNCTION public.products_titlecase_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parts text[];
  out_parts text[] := '{}';
  w text; low text; fixed text;
  i int;
BEGIN
  IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    RETURN NEW;
  END IF;
  NEW.title := regexp_replace(trim(NEW.title), '\s+', ' ', 'g');
  parts := string_to_array(NEW.title, ' ');
  FOR i IN 1..array_length(parts, 1) LOOP
    w := parts[i];
    IF length(w) = 0 THEN
      CONTINUE;
    END IF;
    low := lower(w);
    fixed := CASE
      -- Brand spellings that title-casing mangles.
      WHEN low = 'iphone' THEN 'iPhone'
      WHEN low = 'ipad' THEN 'iPad'
      WHEN low = 'ipod' THEN 'iPod'
      WHEN low = 'imac' THEN 'iMac'
      WHEN low = 'ios' THEN 'iOS'
      WHEN low = 'macos' THEN 'macOS'
      WHEN low = 'macosx' THEN 'macOS'
      WHEN low = 'macbook' THEN 'MacBook'
      WHEN low = 'itunes' THEN 'iTunes'
      WHEN low = 'icloud' THEN 'iCloud'
      -- Connectivity and interface acronyms.
      WHEN low = 'wi-fi' THEN 'Wi-Fi'
      WHEN low = 'wifi' THEN 'Wi-Fi'
      WHEN low = 'wifi6' THEN 'Wi-Fi 6'
      WHEN low = 'usb' THEN 'USB'
      WHEN low = 'usb-c' THEN 'USB-C'
      WHEN low = 'usbc' THEN 'USB-C'
      WHEN low = 'type-c' THEN 'Type-C'
      WHEN low = 'hdmi' THEN 'HDMI'
      WHEN low = 'nfc' THEN 'NFC'
      WHEN low = 'lte' THEN 'LTE'
      WHEN low = 'volte' THEN 'VoLTE'
      WHEN low = '5g' THEN '5G'
      WHEN low = '4g' THEN '4G'
      WHEN low = '3g' THEN '3G'
      WHEN low = 'esim' THEN 'eSIM'
      WHEN low = 'sim' THEN 'SIM'
      WHEN low = 'microsd' THEN 'microSD'
      WHEN low = 'sd' THEN 'SD'
      -- Display and imaging panels.
      WHEN low = 'led' THEN 'LED'
      WHEN low = 'lcd' THEN 'LCD'
      WHEN low = 'oled' THEN 'OLED'
      WHEN low = 'amoled' THEN 'AMOLED'
      WHEN low = 'ips' THEN 'IPS'
      WHEN low = 'tft' THEN 'TFT'
      WHEN low = 'hd' THEN 'HD'
      WHEN low = 'fhd' THEN 'FHD'
      WHEN low = 'qhd' THEN 'QHD'
      WHEN low = 'uhd' THEN 'UHD'
      WHEN low = 'hdr' THEN 'HDR'
      WHEN low = 'anc' THEN 'ANC'
      WHEN low = '4k' THEN '4K'
      WHEN low = '8k' THEN '8K'
      -- Units.
      WHEN low = 'ghz' THEN 'GHz'
      WHEN low = 'mhz' THEN 'MHz'
      WHEN low = 'mah' THEN 'mAh'
      -- Ingress protection ratings.
      WHEN low = 'ip53' THEN 'IP53'
      WHEN low = 'ip67' THEN 'IP67'
      WHEN low = 'ip68' THEN 'IP68'
      -- Digit + unit: 256gb -> 256GB, 48mp -> 48MP, 5000mah -> 5000mAh, 4k handled above.
      WHEN low ~ '^[0-9]+(gb|tb|mb|mp|mah)$' THEN
        substring(low from '^[0-9]+') ||
        CASE substring(low from '(gb|tb|mb|mp|mah)$')
          WHEN 'gb' THEN 'GB'
          WHEN 'tb' THEN 'TB'
          WHEN 'mb' THEN 'MB'
          WHEN 'mp' THEN 'MP'
          WHEN 'mah' THEN 'mAh'
        END
      -- Decimal capacity: 1.5tb -> 1.5TB.
      WHEN low ~ '^[0-9]+\.[0-9]+(gb|tb)$' THEN
        substring(low from '^[0-9]+\.[0-9]+') || upper(substring(low from '(gb|tb)$'))
      ELSE upper(substr(w, 1, 1)) || lower(substr(w, 2))
    END;
    out_parts := out_parts || fixed;
  END LOOP;
  NEW.title := array_to_string(out_parts, ' ');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_titlecase ON public.products;
CREATE TRIGGER trg_products_titlecase
BEFORE INSERT OR UPDATE OF title ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_titlecase_name();

-- Re-normalise existing rows. The trigger above fires on this UPDATE, so every
-- stored title passes through the new rules once ("Apple Iphone 17 Unlocked
-- (256gb)" becomes "Apple iPhone 17 Unlocked (256GB)").
UPDATE public.products SET title = title WHERE title IS NOT NULL;
