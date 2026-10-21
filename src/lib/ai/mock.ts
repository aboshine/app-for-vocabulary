import type { AiRequest } from "./client";

/**
 * Canned answers for AI_PROVIDER=mock, so the UI and tests work without a key.
 * The reading text weaves the requested target words into fixed sentences.
 */
export function mockResponse(request: AiRequest): string {
  const task = request.system.match(/TASK: (\w+)/)?.[1];
  if (task === "fill") return JSON.stringify(mockFill(request.prompt));
  if (task === "pack") return JSON.stringify(mockPack(request.prompt));
  return JSON.stringify(mockReading(request.prompt));
}

function targetsFrom(prompt: string): Array<{ korean: string; meaning: string }> {
  const section = prompt.split("TARGET WORDS")[1]?.split("\n\n")[0] ?? "";
  return [...section.matchAll(/^- (\S[^(]*?) \((.*)\)$/gm)].map((m) => ({ korean: m[1].trim(), meaning: m[2] }));
}

function tok(t: string, lemma: string, gloss: string) {
  return { t, lemma, gloss };
}

function mockReading(prompt: string) {
  const targets = targetsFrom(prompt);
  const base = [
    {
      ko: "오늘은 토요일이에요.",
      tr: "Сегодня суббота.",
      tokens: [tok("오늘은", "오늘", "сегодня"), tok("토요일이에요.", "토요일", "суббота")],
    },
    {
      ko: "아침에 친구하고 같이 시장에 갔어요.",
      tr: "Утром я пошёл с другом на рынок.",
      tokens: [
        tok("아침에", "아침", "утро"),
        tok("친구하고", "친구", "друг"),
        tok("같이", "같이", "вместе"),
        tok("시장에", "시장", "рынок"),
        tok("갔어요.", "가다", "идти"),
      ],
    },
    {
      ko: "시장에는 사람이 정말 많았어요.",
      tr: "На рынке было очень много людей.",
      tokens: [
        tok("시장에는", "시장", "рынок"),
        tok("사람이", "사람", "человек"),
        tok("정말", "정말", "действительно"),
        tok("많았어요.", "많다", "много"),
      ],
    },
  ];
  const extra = targets.map((target) => ({
    ko: `저는 ${target.korean}에 대해 이야기했어요.`,
    tr: `Я поговорил про «${target.meaning}».`,
    tokens: [
      tok("저는", "저", "я"),
      tok(`${target.korean}에`, target.korean, target.meaning),
      tok("대해", "대하다", "о, про"),
      tok("이야기했어요.", "이야기하다", "разговаривать"),
    ],
  }));
  return {
    title: "시장에 간 날",
    titleTr: "День, когда я ходил на рынок",
    sentences: [...base, ...extra, {
      ko: "정말 재미있는 하루였어요.",
      tr: "Это был очень интересный день.",
      tokens: [tok("정말", "정말", "действительно"), tok("재미있는", "재미있다", "интересный"), tok("하루였어요.", "하루", "день")],
    }],
    questions: [
      {
        q: "오늘은 무슨 요일이에요?",
        options: ["월요일", "금요일", "토요일", "일요일"],
        answer: 2,
        explain: "В первом предложении: 오늘은 토요일이에요.",
      },
      {
        q: "누구하고 시장에 갔어요?",
        options: ["가족", "친구", "선생님", "혼자"],
        answer: 1,
        explain: "친구하고 같이 — вместе с другом.",
      },
    ],
    grammar: [
      { pattern: "-하고", explain: "«и / с» между существительными, разговорный вариант 와/과.", example: "친구하고 같이 시장에 갔어요." },
    ],
  };
}

function mockFill(prompt: string) {
  const korean = prompt.match(/expression: (.+)/)?.[1]?.trim() ?? "단어";
  return {
    meaning: `значение «${korean}»`,
    partOfSpeech: "существительное",
    hanja: "",
    exampleSentence: `저는 ${korean}을/를 좋아해요.`,
    exampleTranslation: `Мне нравится ${korean}.`,
    note: "Тестовый ответ (AI_PROVIDER=mock).",
  };
}

function mockPack(prompt: string) {
  const topic = prompt.match(/Topic: (.+)/)?.[1]?.trim() ?? "тема";
  const count = Number(prompt.match(/Give (\d+)/)?.[1] ?? 5);
  return {
    words: Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      korean: `예시${i + 1}`,
      meaning: `${topic}: слово ${i + 1}`,
      exampleSentence: `이것은 예시${i + 1}이에요.`,
      exampleTranslation: `Это пример ${i + 1}.`,
      notes: "сущ.",
    })),
  };
}
