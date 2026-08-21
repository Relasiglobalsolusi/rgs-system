-- Landscaping service area + Regular / One-Time project types + optional team kind.

ALTER TYPE "ProjectSubCategory" ADD VALUE IF NOT EXISTS 'REGULAR_LANDSCAPING';
ALTER TYPE "ProjectSubCategory" ADD VALUE IF NOT EXISTS 'ONE_TIME_LANDSCAPING';

ALTER TYPE "ServiceArea" ADD VALUE IF NOT EXISTS 'LANDSCAPING';

ALTER TYPE "OperationsTeamKind" ADD VALUE IF NOT EXISTS 'LANDSCAPING';
