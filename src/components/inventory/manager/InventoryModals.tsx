import React from 'react';
import { InventoryModalsProps } from './InventoryModalsProps';
import { QuickAdjustModal } from './QuickAdjustModal';
import { LogWastageModal } from './LogWastageModal';
import { AddItemModal } from './AddItemModal';
import { StocktakeModal } from './StocktakeModal';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { GoodsReceivedNoteModal } from './GoodsReceivedNoteModal';

export const InventoryModals: React.FC<InventoryModalsProps> = (props) => {
  return (
    <>
      <QuickAdjustModal
        isOpen={props.isQuickAdjustOpen}
        onClose={() => props.setIsQuickAdjustOpen(null)}
        adjustLocation={props.adjustLocation}
        setAdjustLocation={props.setAdjustLocation}
        adjustQuantity={props.adjustQuantity}
        setAdjustQuantity={props.setAdjustQuantity}
        handleQuickAdjust={props.handleQuickAdjust}
      />
      <LogWastageModal
        isOpen={props.isLogWastageOpen}
        onClose={() => props.setIsLogWastageOpen(false)}
        wasteReason={props.wasteReason}
        setWasteReason={props.setWasteReason}
        wasteQty={props.wasteQty}
        setWasteQty={props.setWasteQty}
        handleLogWastage={props.handleLogWastage}
      />
      <AddItemModal
        isOpen={props.isAddItemOpen}
        onClose={() => props.setIsAddItemOpen(false)}
        addName={props.addName}
        setAddName={props.setAddName}
        addSku={props.addSku}
        setAddSku={props.setAddSku}
        addCategory={props.addCategory}
        setAddCategory={props.setAddCategory}
        addInventoryType={props.addInventoryType}
        setAddInventoryType={props.setAddInventoryType}
        addStorageArea={props.addStorageArea}
        setAddStorageArea={props.setAddStorageArea}
        addBaseUnit={props.addBaseUnit}
        setAddBaseUnit={props.setAddBaseUnit}
        addUnit={props.addUnit}
        setAddUnit={props.setAddUnit}
        addCostPerUnit={props.addCostPerUnit}
        setAddCostPerUnit={props.setAddCostPerUnit}
        addMinThreshold={props.addMinThreshold}
        setAddMinThreshold={props.setAddMinThreshold}
        addParLevel={props.addParLevel}
        setAddParLevel={props.setAddParLevel}
        addInitialStock={props.addInitialStock}
        setAddInitialStock={props.setAddInitialStock}
        addInitialLocation={props.addInitialLocation}
        setAddInitialLocation={props.setAddInitialLocation}
        addDescription={props.addDescription}
        setAddDescription={props.setAddDescription}
        inventoryItems={props.inventoryItems}
        handleCreateStockItem={props.handleCreateStockItem}
      />
      <StocktakeModal
        isOpen={props.isNewStocktakeOpen}
        onClose={() => props.setIsNewStocktakeOpen(false)}
        stocktakeLocation={props.stocktakeLocation}
        setStocktakeLocation={props.setStocktakeLocation}
        handleSubmitStocktake={props.handleSubmitStocktake}
      />
      <PurchaseOrderModal
        isOpen={props.isNewPOOpen}
        onClose={() => props.setIsNewPOOpen(false)}
        poSupplierId={props.poSupplierId}
        setPoSupplierId={props.setPoSupplierId}
        handleCreatePO={props.handleCreatePO}
      />
      <GoodsReceivedNoteModal
        isOpen={props.isNewGRNOpen}
        onClose={() => props.setIsNewGRNOpen(false)}
        grnPoId={props.grnPoId}
        setGrnPoId={props.setGrnPoId}
        handleCreateGRN={props.handleCreateGRN}
      />
    </>
  );
};
