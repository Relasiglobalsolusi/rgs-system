-- Item return / manager resolution statuses for transfer orders.
ALTER TYPE "TransferOrderStatus" ADD VALUE 'NOT_RECEIVED';
ALTER TYPE "TransferOrderStatus" ADD VALUE 'RETURNED';
ALTER TYPE "TransferOrderStatus" ADD VALUE 'NEEDS_ATTENTION';
ALTER TYPE "TransferOrderStatus" ADD VALUE 'WRITTEN_OFF';
