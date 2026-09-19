import { prisma } from "../src/lib/db";

function assertDevelopmentSeed() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Seed data is development-only and will not run in production.");
  }
}

async function main() {
  assertDevelopmentSeed();

  await prisma.grammarReview.deleteMany();
  await prisma.review.deleteMany();
  await prisma.grammar.deleteMany();
  await prisma.vocabulary.deleteMany();
  await prisma.category.deleteMany();

  const greetings = await prisma.category.create({ data: { name: "Greetings" } });
  const food = await prisma.category.create({ data: { name: "Food" } });
  const everyday = await prisma.category.create({ data: { name: "Everyday" } });

  await prisma.vocabulary.createMany({
    data: [
      {
        korean: "안녕하세요",
        meaning: "hello",
        exampleSentence: "안녕하세요, 만나서 반갑습니다.",
        exampleTranslation: "Hello, nice to meet you.",
        notes: "Formal greeting",
        categoryId: greetings.id,
        tags: "greeting,formal",
      },
      {
        korean: "감사합니다",
        meaning: "thank you",
        exampleSentence: "도와주셔서 감사합니다.",
        exampleTranslation: "Thank you for your help.",
        notes: "",
        categoryId: greetings.id,
        tags: "polite",
      },
      {
        korean: "물",
        meaning: "water",
        exampleSentence: "물 한 잔 주세요.",
        exampleTranslation: "Please give me a glass of water.",
        notes: "",
        categoryId: food.id,
        tags: "noun,drink",
      },
      {
        korean: "먹다",
        meaning: "to eat",
        exampleSentence: "저는 밥을 먹어요.",
        exampleTranslation: "I eat rice / a meal.",
        notes: "Dictionary form",
        categoryId: food.id,
        tags: "verb",
      },
      {
        korean: "학교",
        meaning: "school",
        exampleSentence: "학교에 가요.",
        exampleTranslation: "I go to school.",
        notes: "",
        categoryId: everyday.id,
        tags: "noun,place",
      },
      {
        korean: "친구",
        meaning: "friend",
        exampleSentence: "그 사람은 제 친구예요.",
        exampleTranslation: "That person is my friend.",
        notes: "",
        categoryId: everyday.id,
        tags: "noun,people",
      },
    ],
  });

  await prisma.grammar.createMany({
    data: [
      {
        title: "-고 싶다",
        meaning: "to want to",
        structure: "V-고 싶다",
        explanation: "Attach 고 싶다 to a verb stem to express desire.",
        examples: JSON.stringify([
          { sentence: "한국어를 배우고 싶어요.", translation: "I want to learn Korean." },
        ]),
        notes: "Conjugates like an adjective.",
        categoryId: everyday.id,
        tags: "desire,verb",
      },
      {
        title: "-아/어요",
        meaning: "informal polite present",
        structure: "V/A-아/어요",
        explanation: "The everyday polite present/future ending.",
        examples: JSON.stringify([
          { sentence: "지금 먹어요.", translation: "I am eating now." },
        ]),
        notes: "",
        categoryId: greetings.id,
        tags: "conjugation",
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
