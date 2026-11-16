import type { AiRequest } from "./client";

/**
 * Canned answers for AI_PROVIDER=mock, so the UI and tests work without a key.
 * The reading text weaves the requested target words into fixed sentences.
 */
export function mockResponse(request: AiRequest): string {
  const task = request.system.match(/TASK: (\w+)/)?.[1];
  if (task === "fill") return JSON.stringify(mockFill(request.prompt));
  if (task === "pack") return JSON.stringify(mockPack(request.prompt));
  if (task === "explain") return JSON.stringify(mockExplain(request.prompt));
  if (task === "lesson") return JSON.stringify(mockLesson(request.prompt));
  if (task === "wordhelp") return JSON.stringify(mockWordHelp(request.prompt));
  if (task === "chat") return "Тестовый ответ учителя (AI_PROVIDER=mock).\n저는 학생이에요.\nЯ студент.";
  if (task === "weeklynote") return "Тестовый комментарий учителя (AI_PROVIDER=mock).";
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

function mockExplain(prompt: string) {
  const text = prompt.split('"""')[1]?.trim() ?? "";
  const sentences = text.split(/(?<=[.!?。])\s+/).filter(Boolean);
  return {
    sentences: sentences.map((ko) => ({
      ko,
      tr: `Перевод: ${ko}`,
      parts: ko.split(/\s+/).map((chunk) => ({ chunk, base: chunk.replace(/[.,!?]+$/, ""), explain: "тестовое объяснение" })),
      grammar: [{ pattern: "-아요/어요", explain: "Вежливое окончание настоящего времени.", compare: "" }],
    })),
    tip: "Тестовый совет (AI_PROVIDER=mock).",
  };
}

function mockLesson(prompt: string) {
  const pattern = prompt.match(/Grammar point: (.+)/)?.[1]?.trim() ?? "-고";
  return {
    title: pattern,
    meaning: "тестовое значение",
    structure: "после гласной: 가다 → 가고\nпосле согласной: 먹다 → 먹고",
    explanation: "Тестовое объяснение (AI_PROVIDER=mock). Соединяет два действия.",
    compare: "",
    examples: [
      { ko: "밥을 먹고 학교에 가요.", tr: "Ем и иду в университет." },
      { ko: "책을 읽고 자요.", tr: "Читаю книгу и ложусь спать." },
    ],
    mistake: "Не путайте с -아서/어서.",
    exercises: [
      { q: "밥을 ___ 학교에 가요.", options: ["먹고", "먹면", "먹지만", "먹어서"], answer: 0, explain: "Просто последовательность действий." },
      { q: "책을 ___ 자요.", options: ["읽면", "읽고", "읽지만", "읽으러"], answer: 1, explain: "Сначала читаю, потом сплю." },
    ],
  };
}

function mockWordHelp(prompt: string) {
  const korean = prompt.match(/Word: (.+)/)?.[1]?.trim() ?? "단어";
  return {
    parts: "",
    hook: `Тестовая подсказка для «${korean}» (AI_PROVIDER=mock).`,
    collocations: [`${korean} 하나 (один)`],
    confusedWith: [],
    examples: [{ ko: `저는 ${korean}을/를 좋아해요.`, tr: `Мне нравится ${korean}.` }],
  };
}
