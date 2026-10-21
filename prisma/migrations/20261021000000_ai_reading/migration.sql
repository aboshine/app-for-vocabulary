-- AI reading, TOPIK word packs and AI settings.
-- Additive only: new columns have defaults, one new table. No existing data is changed or dropped.

-- AlterTable
ALTER TABLE "Vocabulary" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "level" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "aiLevel" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "aiLang" TEXT NOT NULL DEFAULT 'ru',
ADD COLUMN "currentTheme" TEXT NOT NULL DEFAULT '',
ADD COLUMN "targetsPerText" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN "packSize" INTEGER NOT NULL DEFAULT 8;

-- CreateTable
CREATE TABLE "DailyText" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "targetIds" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyText_day_idx" ON "DailyText"("day");
