import { ShoppingCart, Eye, Zap, Star, Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { CARD_TYPE_COLORS, CARD_TYPE_ACCENT, CARD_TYPE_PILL, RARITY_COLORS, RARITY_HOLO, RARITY_FOIL } from '../lib/constants';
import { useCart } from '../contexts/CartContext';

interface ProductCardProps {
  product: Product;
  onView: (id: string) => void;
}

export default function ProductCard({ product, onView }: ProductCardProps) {
  const { addItem } = useCart();
  const typeGradient = CARD_TYPE_COLORS[product.card_type ?? ''] ?? 'from-gray-400 to-gray-600';
  const typeAccent = CARD_TYPE_ACCENT[product.card_type ?? ''] ?? 'bg-gray-400';
  const typePill = CARD_TYPE_PILL[product.card_type ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const rarityPill = RARITY_COLORS[product.rarity ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const isHolo = RARITY_HOLO[product.rarity ?? ''] ?? false;
  const foilClass = RARITY_FOIL[product.rarity ?? ''] ?? '';

  return (
    <div
      className={`group bg-white rounded-2xl overflow-hidden transition-all duration-300 card-lift cursor-pointer border border-gray-100 shadow-card hover:shadow-card-hover ${foilClass} ${isHolo ? 'holo' : ''}`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Type accent bar */}
      <div className={`h-1 w-full ${typeAccent} flex-shrink-0`} />

      {/* Image area */}
      <div
        className={`relative bg-gradient-to-br ${typeGradient} overflow-hidden`}
        style={{ height: '200px' }}
        onClick={() => onView(product.id)}
      >
        {/* Subtle inner overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent z-10" />

        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Zap className="w-16 h-16 text-white/25" />
          </div>
        )}

        {/* Featured badge */}
        {product.is_featured && (
          <div className="absolute top-2.5 left-2.5 z-20 bg-amber-500/95 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
            <Star className="w-2.5 h-2.5 fill-white" />
            FEATURED
          </div>
        )}

        {/* Holo indicator for special cards */}
        {isHolo && !product.is_featured && (
          <div className="absolute top-2.5 left-2.5 z-20 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-white/30">
            <Sparkles className="w-2.5 h-2.5" />
            HOLO
          </div>
        )}

        {/* Price badge */}
        <div className="absolute bottom-2.5 right-2.5 z-20 bg-gray-950/80 backdrop-blur-sm text-white text-sm font-bold px-2.5 py-1 rounded-lg shadow border border-white/10">
          ${product.price.toFixed(2)}
        </div>

        {/* Out of stock overlay */}
        {!product.in_stock && (
          <div className="absolute inset-0 z-30 bg-gray-900/70 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-white font-bold text-base tracking-wider px-3 py-1.5 rounded-lg bg-black/40 border border-white/20">
              OUT OF STOCK
            </span>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name */}
        <h3
          className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-red-600 transition-colors cursor-pointer"
          onClick={() => onView(product.id)}
        >
          {product.name}
        </h3>

        {/* Set + card number */}
        {(product.set_name || product.card_number) && (
          <p className="text-[11px] text-gray-400 mb-2 truncate">
            {[product.set_name, product.card_number ? `#${product.card_number}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        {/* Type + Rarity pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {product.card_type && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typePill}`}>
              {product.card_type}
            </span>
          )}
          {product.rarity && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rarityPill}`}>
              {product.rarity}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3 text-[11px] text-gray-500">
          {product.hp && (
            <span className="flex items-center gap-1">
              <span className="font-semibold text-gray-700">HP</span>
              <span>{product.hp}</span>
            </span>
          )}
          {product.condition && (
            <span className="bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 font-medium">
              {product.condition}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          <button
            onClick={() => onView(product.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            Details
          </button>
          {product.in_stock && product.quantity > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); addItem(product); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all shadow-sm shadow-red-900/20"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
