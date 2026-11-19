// Альбом воспоминаний: развороты с перелистыванием страниц (CSS 3D).
// Левая страница — дата и фото, правая — текст, песня и настроение.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store";
import type { Memory } from "../types";
import { formatDate } from "../util";

const FLIP_MS = 650;

export function AlbumBook() {
  const memories = useStore((s) => s.memories);
  const setPanel = useStore((s) => s.setPanel);
  const setPreview = useStore((s) => s.setPreview);
  const relive = useStore((s) => s.relive);
  const removeMemory = useStore((s) => s.removeMemory);
  const [index, setIndex] = useState(() => Math.max(0, memories.length - 1));
  const [flip, setFlip] = useState<null | "next" | "prev">(null);
  const timer = useRef<number | null>(null);

  const total = memories.length + 1; // последний разворот — «новая запись»
  const current = memories[index];

  useEffect(() => {
    setPreview(current?.atmosphere ?? null);
  }, [current, setPreview]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
    setPreview(null);
  }, [setPreview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go("next");
      if (e.key === "ArrowLeft") go("prev");
      if (e.key === "Escape") setPanel("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function go(dir: "next" | "prev") {
    if (flip) return;
    if (dir === "next" && index >= total - 1) return;
    if (dir === "prev" && index <= 0) return;
    setFlip(dir);
    timer.current = window.setTimeout(() => {
      setIndex((i) => i + (dir === "next" ? 1 : -1));
      setFlip(null);
    }, FLIP_MS);
  }

  const leftOf = (i: number) => (i < memories.length ? <LeftPage m={memories[i]} /> : <NewLeft />);
  const rightOf = (i: number) =>
    i < memories.length ? (
      <RightPage
        m={memories[i]}
        onRelive={() => relive(memories[i])}
        onDelete={async () => {
          await removeMemory(memories[i].id);
          setIndex((x) => Math.max(0, Math.min(x, memories.length - 2)));
        }}
      />
    ) : (
      <NewRight onCreate={() => setPanel("create")} />
    );

  // Что лежит «под» перелистываемым листом
  const baseLeft = flip === "prev" ? leftOf(index - 1) : leftOf(index);
  const baseRight = flip === "next" ? rightOf(index + 1) : rightOf(index);

  return (
    <div className="album-wrap" onClick={() => setPanel("none")}>
      <div className="album" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <Page side="left">{baseLeft}</Page>
          <Page side="right">{baseRight}</Page>
          {flip === "next" && (
            <div className="leaf leaf-right flipping-next">
              <div className="leaf-face front"><Page side="right">{rightOf(index)}</Page></div>
              <div className="leaf-face back"><Page side="left">{leftOf(index + 1)}</Page></div>
            </div>
          )}
          {flip === "prev" && (
            <div className="leaf leaf-left flipping-prev">
              <div className="leaf-face front"><Page side="left">{leftOf(index)}</Page></div>
              <div className="leaf-face back"><Page side="right">{rightOf(index - 1)}</Page></div>
            </div>
          )}
          <div className="spine" />
        </div>
        <div className="album-nav">
          <button className="ghost" disabled={index === 0 || !!flip} onClick={() => go("prev")}>← Назад</button>
          <span className="page-count">{Math.min(index + 1, total)} / {total}</span>
          <button className="ghost" disabled={index >= total - 1 || !!flip} onClick={() => go("next")}>Вперёд →</button>
        </div>
        <button className="close" aria-label="Закрыть альбом" onClick={() => setPanel("none")}>×</button>
      </div>
    </div>
  );
}

function Page({ side, children }: { side: "left" | "right"; children: ReactNode }) {
  return <div className={`page page-${side}`}>{children}</div>;
}

function LeftPage({ m }: { m: Memory }) {
  return (
    <div className="page-inner">
      <div className="date">{formatDate(m.date)}</div>
      <div className={`photos n${Math.min(m.photos.length, 3)}`}>
        {m.photos.slice(0, 3).map((p, i) => (
          <div className="polaroid" key={i} style={{ transform: `rotate(${(i % 2 ? 1 : -1) * (2 + i * 1.5)}deg)` }}>
            <img src={p} alt="" />
          </div>
        ))}
        {!m.photos.length && <div className="no-photo">без фото</div>}
      </div>
    </div>
  );
}

function RightPage({ m, onRelive, onDelete }: { m: Memory; onRelive: () => void; onDelete: () => void }) {
  return (
    <div className="page-inner">
      <h2 className="mem-title">{m.title}</h2>
      <p className="mem-text">{m.text}</p>
      <div className="song">♪ {m.music.name || "без названия"}</div>
      <div className="mood">
        <div className="swatches">
          {m.atmosphere.palette.map((c, i) => <span key={i} style={{ background: c }} />)}
        </div>
        <div>
          <b>{m.atmosphere.mood}</b>
          <small>{m.atmosphereSource === "claude" ? "атмосфера от Claude" : "атмосфера из локального анализа"}</small>
        </div>
      </div>
      <div className="page-actions">
        <button className="primary" onClick={onRelive}>▶ Пережить этот день</button>
        {!m.demo && <button className="ghost small" onClick={onDelete}>удалить</button>}
      </div>
    </div>
  );
}

function NewLeft() {
  return (
    <div className="page-inner center">
      <div className="big-plus">+</div>
      <p className="muted">Здесь будет ваш следующий день</p>
    </div>
  );
}

function NewRight({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="page-inner center">
      <h2 className="mem-title">Новая запись</h2>
      <p className="muted">Короткий текст, пара фото и песня. Комната сама подберёт свет, цвета и частицы под этот день.</p>
      <button className="primary" onClick={onCreate}>Записать день</button>
    </div>
  );
}
