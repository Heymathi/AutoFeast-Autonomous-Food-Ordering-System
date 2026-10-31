import React, { useEffect, useMemo, useState } from 'react';
import { FoodItem, PlatformPriceOption } from '../types';
import { INDIAN_FOOD_CATALOG } from '../data/indianFoodCatalog';

interface BillLine {
  foodItem: FoodItem;
  quantity: number;
  platforms?: PlatformPriceOption[];
}

interface PlatformComparisonSectionProps {
  items: BillLine[];
  language: string;
}

/**
 * Live Platform Comparison for the invoice modal.
 * Reads the SAME data as the food card (foodItem.platforms) and renders the
 * same "name / ★ rating / price / strikethrough original" cards. For a
 * multi-item order the totals are summed per platform (price x quantity).
 */
export const PlatformComparisonSection: React.FC<PlatformComparisonSectionProps> = ({ items, language }) => {
  const [loading, setLoading] = useState(true);

  // Temporary diagnostic logging to trace received items and platforms in DevTools
  console.log('[PlatformComparisonSection]: received items ->', items);
  console.log(
    '[PlatformComparisonSection]: items platforms ->',
    (items || []).map(i => ({
      name: i?.foodItem?.name,
      platforms: i?.platforms || i?.foodItem?.platforms
    }))
  );

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(timer);
  }, [items]);

  const rows = useMemo(() => {
    try {
      if (!items || items.length === 0) return [];

      // Resolve platforms for each line: check line.platforms -> foodItem.platforms -> catalog fallback
      const linesWithPlatforms = items.map(line => {
        const food = line.foodItem || ({} as FoodItem);
        const catalogMatch = INDIAN_FOOD_CATALOG.find(
          f => (food.id && f.id === food.id) || (food.name && f.name.toLowerCase() === food.name.toLowerCase())
        );
        const resolvedPlatforms: PlatformPriceOption[] =
          (line.platforms && line.platforms.length > 0)
            ? line.platforms
            : (food.platforms && food.platforms.length > 0)
            ? food.platforms
            : (catalogMatch?.platforms || []);

        return {
          line,
          platforms: resolvedPlatforms
        };
      });

      // If any item completely lacks platform data, we cannot compute combined prices
      const validLines = linesWithPlatforms.filter(l => l.platforms.length > 0);
      if (validLines.length === 0 || validLines.length !== items.length) return [];

      const basePlatforms = validLines[0].platforms;
      return basePlatforms.map(bp => {
        let price = 0;
        let original = 0;
        for (const { line, platforms } of validLines) {
          const p = platforms.find(x => x.platform === bp.platform);
          if (!p) return null;
          const qty = line.quantity || 1;
          price += p.price * qty;
          original += (p.originalPrice ?? p.price) * qty;
        }
        return {
          key: bp.platform,
          name: bp.platformName,
          rating: bp.rating,
          price: price + bp.deliveryFee,
          original: original + bp.deliveryFee
        };
      }).filter(Boolean) as { key: string; name: string; rating: number; price: number; original: number }[];
    } catch (err) {
      console.error('[PlatformComparisonSection]: Error computing platform comparison:', err);
      return [];
    }
  }, [items]);

  const label = language === 'ta' ? 'நேரடி தள ஒப்பீடு:' : language === 'hi' ? 'लाइव प्लेटफॉर्म तुलना:' : 'Live Platform Comparison:';
  const saveLabel = language === 'ta' ? 'சேமிப்பு' : language === 'hi' ? 'बचत' : 'Save';
  const bestLabel = language === 'ta' ? 'சிறந்த விலை' : language === 'hi' ? 'सबसे सस्ता' : 'Best Price';
  const unavailable = language === 'ta'
    ? 'இந்த உணவுக்கான நேரடி விலை ஒப்பீடு கிடைக்கவில்லை (Price comparison unavailable for this item)'
    : language === 'hi'
    ? 'इस आइटम के लिए कीमत तुलना उपलब्ध नहीं है (Price comparison unavailable for this item)'
    : 'Price comparison unavailable for this item';

  const min = rows.length ? Math.min(...rows.map(r => r.price)) : 0;
  const max = rows.length ? Math.max(...rows.map(r => r.price)) : 0;
  const bestKey = rows.find(r => r.price === min)?.key;

  return (
    <div className="space-y-2" data-testid="platform-comparison-section">
      <div className="flex items-center justify-between text-xs font-black uppercase text-[#4A5568] dark:text-slate-400 tracking-wider">
        <span>{label}</span>
        {!loading && rows.length > 0 && (
          <span className="text-[#087F5B] font-black bg-[#087F5B]/10 px-2 py-0.5 rounded-full normal-case tracking-normal">
            {saveLabel} ₹{max - min}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2" aria-busy="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[62px] rounded-[14px] bg-slate-200 dark:bg-slate-700 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 p-2.5 rounded-[14px] border border-dashed border-slate-300 dark:border-slate-600 text-center">
          {unavailable}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {rows.map(r => {
            const isBest = r.key === bestKey;
            return (
              <div
                key={r.key}
                className={`relative p-2.5 rounded-[14px] border-2 flex flex-col justify-between min-w-0 ${
                  isBest
                    ? 'bg-[#16A34A]/10 border-[#16A34A]'
                    : 'bg-[#DFF3E8]/40 dark:bg-slate-800 border-[#E4EBE5] dark:border-slate-700'
                }`}
              >
                {isBest && (
                  <span className="absolute -top-2 right-2 text-[8px] font-black bg-[#16A34A] text-white px-1.5 py-0.5 rounded-full uppercase">
                    {bestLabel}
                  </span>
                )}
                <div className="flex items-center justify-between gap-1 font-black text-[#242B27] dark:text-white">
                  <span className="truncate">{r.name}</span>
                  <span className="text-[11px] text-[#4A5568] dark:text-slate-300 font-bold shrink-0">★ {r.rating}</span>
                </div>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="text-sm font-black text-[#087F5B]">₹{r.price}</span>
                  <span className="text-[10px] text-[#4A5568] dark:text-slate-400 line-through">₹{r.original}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
