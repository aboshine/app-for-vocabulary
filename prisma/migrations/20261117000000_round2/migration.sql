-- Deck translation, AI answer cache, writing practice.
-- Additive: new columns have defaults, two new tables. Nothing is dropped.

-- AlterTable
ALTER TABLE "Vocabulary" ADD COLUMN "meaningLang" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "TutorCache" (
    "key" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WritingEntry" (
    "id" TEXT NOT NULL,
    "wordIds" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutorCache_createdAt_idx" ON "TutorCache"("createdAt");

-- CreateIndex
CREATE INDEX "WritingEntry_createdAt_idx" ON "WritingEntry"("createdAt");

-- Every word that exists today has a Russian meaning (built-in packs and earlier AI packs were Russian).
UPDATE "Vocabulary" SET "meaningLang" = 'ru';
