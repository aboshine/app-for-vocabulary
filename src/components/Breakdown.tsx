"use client";

import type { ExplainPayload } from "@/lib/ai/tutor-prompts";
import { speakKorean } from "@/lib/speech";

/** The teacher's breakdown of one or more sentences: translation, word-by-word, grammar. */
export function Breakdown({ data, showSentence = true }: { data: ExplainPayload; showSentence?: boolean }) {
  return (
    <>
      {data.sentences.map((s, i) => (
        <div className="breakdown" key={i}>
          {showSentence ? (
            <p className="ko-small">
              <strong>{s.ko}</strong>{" "}
              <button type="button" className="icon" aria-label="Play sentence" onClick={() => speakKorean(s.ko)}>▶</button>
            </p>
          ) : null}
          {s.tr ? <p className="muted">{s.tr}</p> : null}
          {s.parts.map((part, pi) => (
            <div className="part" key={pi}>
              <span>
                <strong>{part.chunk}</strong>
                {part.base && part.base !== part.chunk ? <span className="muted" style={{ display: "block", fontSize: "0.8rem" }}>{part.base}</span> : null}
              </span>
              <span>{part.explain}</span>
            </div>
          ))}
          {s.grammar.map((g, gi) => (
            <div className="gram" key={gi}>
              <strong>{g.pattern}</strong> {g.explain}
              {g.compare ? <div className="cmp">≈ {g.compare}</div> : null}
            </div>
          ))}
        </div>
      ))}
      {data.tip ? <p className="notice card" style={{ marginBottom: 0 }}>💡 {data.tip}</p> : null}
    </>
  );
}
