import AddToCartGroup from './AddToCartGroup';
import AddToCartQuantity from './AddToCartQuantity';

// ⬇️ Added onOpenQuickView
export default function AddToCartModal({
  open,
  onClose,
  product,
  bumpPrice,
  onOpenQuickView,
  onCartAddSuccess,
  pagePlacementMap = {},
  customBackAllowedSet = {},
}) {
  if (!product) return null;
  const groupType = product.acf?.group_type;
  if (!open) return null;
  if (groupType === 'Group') {
    return (
      <AddToCartGroup
        open={open}
        onClose={onClose}
        product={product}
        bumpPrice={bumpPrice}
        onOpenQuickView={onOpenQuickView}
        onCartAddSuccess={onCartAddSuccess}
        pagePlacementMap={pagePlacementMap}
        customBackAllowedSet={customBackAllowedSet}
      />
    );
  }
  if (groupType === 'Quantity') {
    return (
      <AddToCartQuantity
        open={open}
        onClose={onClose}
        product={product}
        bumpPrice={bumpPrice}
        onCartAddSuccess={onCartAddSuccess}
        pagePlacementMap={pagePlacementMap}
        customBackAllowedSet={customBackAllowedSet}
      />
    );
  }
  return null;
}
