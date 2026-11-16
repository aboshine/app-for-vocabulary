-- Study plan, weekly check, AI grammar lessons, Telegram reminders.
-- Additive: new columns have defaults, two new tables. Nothing is dropped.
-- One value changes: see the UPDATE at the end.

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "dailyMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "telegramChatId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "remindersOn" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "WeeklyCheck" (
    "id" TEXT NOT NULL,
    "questions" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "score" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarLesson" (
    "id" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT '',
    "payload" TEXT NOT NULL,
    "grammarId" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrammarLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyCheck_createdAt_idx" ON "WeeklyCheck"("createdAt");

-- CreateIndex
CREATE INDEX "GrammarLesson_patternKey_idx" ON "GrammarLesson"("patternKey");

-- The plan now starts at "about 15 minutes a day" = 5 new words a day.
-- Only touch the value if it is still the old default (10); a number chosen by hand is kept.
UPDATE "AppSettings" SET "dailyNewWordLimit" = 5 WHERE "dailyNewWordLimit" = 10;
