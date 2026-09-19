-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vocabulary" (
    "id" TEXT NOT NULL,
    "korean" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "exampleSentence" TEXT NOT NULL DEFAULT '',
    "exampleTranslation" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT,
    "tags" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "learningState" TEXT NOT NULL DEFAULT 'new',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "againCount" INTEGER NOT NULL DEFAULT 0,
    "hardCount" INTEGER NOT NULL DEFAULT 0,
    "goodCount" INTEGER NOT NULL DEFAULT 0,
    "easyCount" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "intervalMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "intervalBefore" INTEGER NOT NULL,
    "intervalAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grammar" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "structure" TEXT NOT NULL DEFAULT '',
    "examples" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT,
    "tags" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "learningState" TEXT NOT NULL DEFAULT 'new',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "againCount" INTEGER NOT NULL DEFAULT 0,
    "hardCount" INTEGER NOT NULL DEFAULT 0,
    "goodCount" INTEGER NOT NULL DEFAULT 0,
    "easyCount" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "intervalMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Grammar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarReview" (
    "id" TEXT NOT NULL,
    "grammarId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "intervalBefore" INTEGER NOT NULL,
    "intervalAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrammarReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "dailyNewWordLimit" INTEGER NOT NULL DEFAULT 10,
    "sessionLimit" TEXT NOT NULL DEFAULT '10',
    "defaultMode" TEXT NOT NULL DEFAULT 'mixed',
    "mixedModes" TEXT NOT NULL DEFAULT '',
    "includeNew" BOOLEAN NOT NULL DEFAULT true,
    "defaultCategoryId" TEXT NOT NULL DEFAULT '',
    "dailyReviewTarget" INTEGER NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Vocabulary_nextReviewAt_idx" ON "Vocabulary"("nextReviewAt");

-- CreateIndex
CREATE INDEX "Vocabulary_learningState_idx" ON "Vocabulary"("learningState");

-- CreateIndex
CREATE INDEX "Vocabulary_categoryId_idx" ON "Vocabulary"("categoryId");

-- CreateIndex
CREATE INDEX "Vocabulary_korean_idx" ON "Vocabulary"("korean");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "Review_vocabularyId_idx" ON "Review"("vocabularyId");

-- CreateIndex
CREATE INDEX "Grammar_nextReviewAt_idx" ON "Grammar"("nextReviewAt");

-- CreateIndex
CREATE INDEX "Grammar_learningState_idx" ON "Grammar"("learningState");

-- CreateIndex
CREATE INDEX "Grammar_categoryId_idx" ON "Grammar"("categoryId");

-- CreateIndex
CREATE INDEX "Grammar_title_idx" ON "Grammar"("title");

-- CreateIndex
CREATE INDEX "GrammarReview_createdAt_idx" ON "GrammarReview"("createdAt");

-- CreateIndex
CREATE INDEX "GrammarReview_grammarId_idx" ON "GrammarReview"("grammarId");

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grammar" ADD CONSTRAINT "Grammar_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarReview" ADD CONSTRAINT "GrammarReview_grammarId_fkey" FOREIGN KEY ("grammarId") REFERENCES "Grammar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

