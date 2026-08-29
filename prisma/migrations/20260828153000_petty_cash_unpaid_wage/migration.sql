-- Part-time wages float as UNPAID after checkout until someone claims Pay.

ALTER TYPE "PettyCashEntryStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
