# Korean Vocab

Private Korean vocabulary app: themed TOPIK word packs, a daily AI reading text at your level, and spaced-repetition flashcards.

## How to use it

1. **Learn** → pick a theme and add a pack of words (8 by default). Learn one theme at a time.
2. **Read** → generate today's text. It is a short story at your TOPIK level built around the words you are learning now and the ones due for review. Tap any word for its meaning; tap ▶ to listen and 文 for the translation. At the end, mark the words you forgot and press *Finish reading* (this counts as a review).
3. **Review** → the usual flashcards.
4. **Add word → ✨ Fill with AI** fills meaning, an example and notes for you.

## Setup

```bash
npm install
npx prisma db push      # also adds the new tables to an existing database, your words stay
npm run db:seed         # only for a fresh database (it deletes everything!)
```

### AI key (free)

1. Open https://aistudio.google.com/apikey, sign in with Google, press **Create API key**.
2. Put it into `.env` (see `.env.example`):

```
GEMINI_API_KEY=your-key
```

3. Restart the app. Settings shows whether AI is connected.

The Gemini free tier is enough for one or two texts a day plus card filling. If the main model hits its daily limit, the app retries with the lighter one automatically. Models can be changed with `GEMINI_MODEL` / `GEMINI_FAST_MODEL`.

Optional instead of Gemini: `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (Claude Haiku, paid but cheap).
`AI_PROVIDER=mock` gives canned answers, for trying the UI without a key.

## Run

```bash
npm run dev
```

Open http://localhost:3000

## Test

```bash
npm test
```
