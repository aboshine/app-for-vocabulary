import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatInterval, isValidVocabId, vocabStatusLabel, wordDetailStats } from "@/lib/vocab-detail";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidVocabId(id)) {
    return NextResponse.json({ error: "Invalid vocabulary id." }, { status: 400 });
  }
  const word = await prisma.vocabulary.findUnique({
    where: { id },
    select: {
      id: true,
      korean: true,
      meaning: true,
      exampleSentence: true,
      exampleTranslation: true,
      notes: true,
      tags: true,
      learningState: true,
      intervalMinutes: true,
      nextReviewAt: true,
      lastReviewedAt: true,
      reviewCount: true,
      againCount: true,
      hardCount: true,
      goodCount: true,
      easyCount: true,
      category: { select: { id: true, name: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          direction: true,
          rating: true,
          intervalAfter: true,
        },
      },
    },
  });
  if (!word) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const stats = wordDetailStats(word);
  return NextResponse.json({
    id: word.id,
    korean: word.korean,
    meaning: word.meaning,
    exampleSentence: word.exampleSentence,
    exampleTranslation: word.exampleTranslation,
    notes: word.notes,
    tags: word.tags,
    category: word.category,
    learningState: word.learningState,
    status: vocabStatusLabel(word.learningState, word.intervalMinutes),
    intervalMinutes: word.intervalMinutes,
    intervalLabel: formatInterval(word.intervalMinutes),
    nextReviewAt: word.nextReviewAt,
    lastReviewedAt: word.lastReviewedAt,
    stats,
    history: word.reviews.map((review) => ({
      id: review.id,
      createdAt: review.createdAt,
      mode: review.direction,
      rating: review.rating,
      intervalAfter: review.intervalAfter,
      intervalLabel: formatInterval(review.intervalAfter),
    })),
  });
}
