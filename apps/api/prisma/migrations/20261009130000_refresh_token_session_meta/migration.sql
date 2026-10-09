-- Session metadata for the admin sessions view: which client, and when the session was last used.
ALTER TABLE "RefreshToken"
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);
