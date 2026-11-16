/**
 * Ordered grammar syllabus, TOPIK 1 → 3. The AI teacher writes one lesson per
 * entry (explanation + examples + exercises); the list only fixes the order so
 * lessons build on each other and never repeat.
 */

export interface SyllabusItem {
  key: string;
  pattern: string;
  level: 1 | 2 | 3;
  /** short English description passed to the AI */
  hint: string;
}

const item = (key: string, pattern: string, level: 1 | 2 | 3, hint: string): SyllabusItem => ({ key, pattern, level, hint });

export const GRAMMAR_SYLLABUS: readonly SyllabusItem[] = [
  // ---- TOPIK 1
  item("copula", "이에요/예요", 1, "noun + to be (polite): 학생이에요, 의사예요; negative 이/가 아니에요"),
  item("topic-subject", "은/는 · 이/가", 1, "topic particle vs subject particle and when each is used"),
  item("object", "을/를", 1, "object particle"),
  item("present", "-아요/어요", 1, "polite present tense, including 하다 → 해요 and vowel contractions"),
  item("exist", "있어요/없어요", 1, "to exist / to have, with location 에"),
  item("place", "에 · 에서", 1, "에 for destination, time and location of existence; 에서 for where an action happens and 'from'"),
  item("past", "-았어요/었어요", 1, "polite past tense"),
  item("negation", "안 · -지 않다", 1, "short and long negation"),
  item("cannot", "못 · -지 못하다", 1, "cannot / was not able to"),
  item("want", "-고 싶다", 1, "want to do"),
  item("and-nouns", "하고 · 와/과 · (이)랑", 1, "'and / with' between nouns"),
  item("and-verbs", "-고", 1, "connecting two actions or states: and / and then"),
  item("future", "-(으)ㄹ 거예요", 1, "future plan or guess"),
  item("request", "-(으)세요 · -지 마세요", 1, "polite request and polite 'please don't'"),
  item("shall-we", "-(으)ㄹ까요? · -(으)ㅂ시다", 1, "suggesting: shall we? / let's"),
  item("numbers", "하나/둘 · 일/이 + counters", 1, "native vs Sino-Korean numbers and common counters 개, 명, 시, 분, 원"),
  item("from-to", "부터 · 까지 · 에서 … 까지", 1, "from … to for time and place"),
  item("also-only", "도 · 만", 1, "'also' and 'only' particles"),
  item("to-person", "에게/한테 · 에게서/한테서", 1, "to a person / from a person"),
  item("progressive", "-고 있다", 1, "action in progress"),
  item("go-to-do", "-(으)러 가다/오다", 1, "go / come in order to do"),
  item("but", "-지만", 1, "but, although"),
  // ---- TOPIK 2
  item("because-aseo", "-아서/어서", 2, "reason (so) and sequence of closely linked actions; no past tense or commands after it"),
  item("because-nikka", "-(으)니까", 2, "reason, used with commands and suggestions; difference from -아서/어서"),
  item("if", "-(으)면", 2, "if / when (condition)"),
  item("can", "-(으)ㄹ 수 있다/없다", 2, "can / cannot (ability or possibility)"),
  item("must", "-아야/어야 하다/되다", 2, "must, have to"),
  item("may", "-아도/어도 되다 · -(으)면 안 되다", 2, "permission and prohibition"),
  item("try", "-아/어 보다", 2, "try doing; have done before (experience)"),
  item("for-someone", "-아/어 주다 · -아/어 주세요", 2, "do something for someone; please do for me"),
  item("before-after", "-기 전에 · -(으)ㄴ 후에", 2, "before doing / after doing"),
  item("when", "-(으)ㄹ 때", 2, "when, at the time of"),
  item("background", "-는데 · -(으)ㄴ데", 2, "background, contrast, soft lead-in before a question or request"),
  item("modifier-present", "-는 (verb) · -(으)ㄴ (adjective)", 2, "describing a noun: present verb modifier and adjective modifier"),
  item("modifier-past-future", "-(으)ㄴ (past verb) · -(으)ㄹ (future)", 2, "describing a noun with a past or future action"),
  item("intend", "-(으)려고 하다 · -(으)려고", 2, "intend to; in order to"),
  item("will", "-(으)ㄹ게요 · -겠다", 2, "promise or decision made now; -겠- for intention and polite guess"),
  item("seems", "-는 것 같다 · -(으)ㄴ 것 같다 · -(으)ㄹ 것 같다", 2, "it seems / I think that (present, past, future)"),
  item("nominal", "-는 것 · -기", 2, "turning a verb into a noun: liking doing, doing is hard"),
  item("comparison", "보다 (더) · 제일/가장", 2, "comparative and superlative"),
  item("become", "-아/어지다 · -게 되다", 2, "become (adjective); come to do, end up doing"),
  item("adverb", "-게", 2, "making an adverb from an adjective: 크게, 맛있게"),
  item("while", "-(으)면서", 2, "doing two things at the same time"),
  item("or", "-거나 · (이)나", 2, "or between verbs and between nouns"),
  item("honorific", "-(으)시- · 께서 · special verbs", 2, "honorific forms: 가세요, 드시다, 주무시다, 계시다"),
  item("right", "-지요? (-죠?)", 2, "confirming: right? isn't it?"),
  item("exclaim", "-네요 · -군요", 2, "surprise or new realisation"),
  item("decide", "-기로 하다", 2, "decide to do"),
  item("experience", "-(으)ㄴ 적이 있다/없다", 2, "have / have never done"),
  item("irregular", "ㅂ · ㄷ · 르 · ㅎ · ㄹ irregular verbs", 2, "the common irregular conjugations with 덥다, 듣다, 모르다, 그렇다, 살다"),
  item("casual", "반말 (-아/어, -야)", 2, "casual speech with friends and when it is appropriate"),
  item("formal", "-(스)ㅂ니다 · -(스)ㅂ니까?", 2, "formal polite style used in announcements, presentations and TOPIK texts"),
  // ---- TOPIK 3
  item("quote", "-다고 하다 · -(이)라고 하다", 3, "indirect speech for statements"),
  item("quote-ask", "-냐고 하다 · -(으)라고 하다 · -자고 하다", 3, "indirect questions, commands and suggestions"),
  item("because-noun", "때문에 · -기 때문에", 3, "because of (stronger, often negative reason)"),
  item("so-that", "-도록 · -게", 3, "so that, in order that"),
  item("even-if", "-아도/어도", 3, "even if, even though"),
  item("as-soon", "-자마자", 3, "as soon as"),
  item("while-doing", "-다가", 3, "interrupting one action to do another"),
  item("worry", "-(으)ㄹ까 봐", 3, "for fear that, worried that"),
  item("only-need", "-기만 하면 되다 · -(으)ㄹ 수밖에 없다", 3, "all you need to do is; have no choice but to"),
  item("passive", "-이/히/리/기- (passive)", 3, "common passive verbs: 보이다, 들리다, 열리다, 잡히다"),
  item("causative", "-이/히/리/기/우- · -게 하다", 3, "causative: make / let someone do"),
  item("guess", "-(으)ㄹ 텐데 · -나 보다 · -(으)ㄴ가 보다", 3, "expectation and guessing from evidence"),
];

export function findSyllabusItem(key: string): SyllabusItem | undefined {
  return GRAMMAR_SYLLABUS.find((entry) => entry.key === key);
}

/**
 * The lesson to suggest next: the first unfinished pattern at the learner's level,
 * then anything unfinished below it, then the next level up.
 */
export function nextSyllabusItem(done: ReadonlySet<string>, level: number): SyllabusItem | undefined {
  const cap = Math.min(3, Math.max(1, level));
  const open = GRAMMAR_SYLLABUS.filter((entry) => !done.has(entry.key));
  return open.find((e) => e.level === cap) ?? open.find((e) => e.level < cap) ?? open[0];
}
