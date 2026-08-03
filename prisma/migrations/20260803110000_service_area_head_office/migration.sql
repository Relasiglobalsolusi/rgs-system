-- OM approval areas: Head Office (leave / desk staff), in addition to project service areas.
ALTER TYPE "ServiceArea" ADD VALUE IF NOT EXISTS 'HEAD_OFFICE';
