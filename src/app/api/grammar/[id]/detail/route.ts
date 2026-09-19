import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseStoredExamples } from "@/lib/validation";
import { formatInterval, isValidVocabId, vocabStatusLabel, wordDetailStats } from "@/lib/vocab-detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidVocabId(id)) {
    return NextResponse.json({ error: "Invalid grammar id." }, { status: 400 });
  }
  const item = await prisma.grammar.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      meaning: true,
      explanation: true,
      structure: true,
      examples: true,
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
          rating: true,
          intervalAfter: true,
        },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const stats = wordDetailStats(item);
  return NextResponse.json({
    id: item.id,
    title: item.title,
    meaning: item.meaning,
    explanation: item.explanation,
    structure: item.structure,
    examples: parseStoredExamples(item.examples),
    notes: item.notes,
    tags: item.tags,
    category: item.category,
    learningState: item.learningState,
    status: vocabStatusLabel(item.learningState, item.intervalMinutes),
    interval: item.intervalMinutes,
    intervalMinutes: item.intervalMinutes,
    intervalLabel: formatInterval(item.intervalMinutes),
    nextReviewAt: item.nextReviewAt,
    lastReviewedAt: item.lastReviewedAt,
    stats,
    history: item.reviews.map((review) => ({
      id: review.id,
      createdAt: review.createdAt,
      rating: review.rating,
      intervalAfter: review.intervalAfter,
      intervalLabel: formatInterval(review.intervalAfter),
    })),
  });
}
