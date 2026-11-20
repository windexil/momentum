// Панель кастомизации персонажа и питомца.

import { MOOD_RU, useAvatar, type Avatar, type HeadphoneKind, type PetKind, type PetMood, type TopKind } from "../avatar";
import { useStore } from "../store";

const CLOTH = ["#f28c28", "#e85d75", "#ffd166", "#7bc67e", "#4fb3bf", "#3f6fb5", "#8e6cc8", "#f4efe6", "#3a3a40", "#c0504d"];
const PANTS = ["#3f6fb5", "#2d3e63", "#5c4a3d", "#3a3a40", "#c9b79c", "#7bc67e", "#e85d75", "#f4efe6"];
const HP = ["#2b2b31", "#f4efe6", "#ffb3c7", "#f28c28", "#4fb3bf", "#8e6cc8", "#ffd166", "#c0504d"];
const HAIR = ["#2b2220", "#6b4226", "#c98b4a", "#f0d58c", "#c0504d", "#8e6cc8", "#4fb3bf"];
const SKIN = ["#f9dfc8", "#f6d3b5", "#e8b48f", "#c98d63", "#8d5a3b", "#5c3a26"];
const PET = ["#f2a65a", "#3a3a40", "#f4efe6", "#9a9a9f", "#c98b4a", "#f0d58c"];

export function CustomizePanel() {
  const avatar = useAvatar((s) => s.avatar);
  const set = useAvatar((s) => s.set);
  const reset = useAvatar((s) => s.reset);
  const setPanel = useStore((s) => s.setPanel);

  return (
    <aside className="custom">
      <div className="custom-head">
        <h2>Персонаж</h2>
        <button className="close inline" aria-label="Закрыть" onClick={() => setPanel("none")}>×</button>
      </div>

      <Section title="Одежда">
        <Choice<TopKind>
          value={avatar.top}
          onChange={(top) => set({ top })}
          options={[["hoodie", "Толстовка"], ["tshirt", "Футболка"], ["sweater", "Кофта"]]}
        />
        <Colors label="Цвет верха" value={avatar.topColor} list={CLOTH} onChange={(topColor) => set({ topColor })} />
        <Colors label="Штаны" value={avatar.pantsColor} list={PANTS} onChange={(pantsColor) => set({ pantsColor })} />
        <Colors label="Кроссовки" value={avatar.shoesColor} list={CLOTH} onChange={(shoesColor) => set({ shoesColor })} />
      </Section>

      <Section title="Наушники">
        <Choice<HeadphoneKind>
          value={avatar.headphones}
          onChange={(headphones) => set({ headphones })}
          options={[["classic", "Обычные"], ["cat", "С ушками 🐱"]]}
        />
        <Colors label="Корпус" value={avatar.headphonesColor} list={HP} onChange={(headphonesColor) => set({ headphonesColor })} />
        <Colors label="Амбушюры" value={avatar.padsColor} list={[...new Set(HP.concat(CLOTH))]} onChange={(padsColor) => set({ padsColor })} />
      </Section>

      <Section title="Внешность">
        <Colors label="Волосы" value={avatar.hairColor} list={HAIR} onChange={(hairColor) => set({ hairColor })} />
        <Colors label="Кожа" value={avatar.skinColor} list={SKIN} onChange={(skinColor) => set({ skinColor })} />
      </Section>

      <Section title="Питомец">
        <Choice<PetKind>
          value={avatar.pet}
          onChange={(pet) => set({ pet })}
          options={[["none", "Нет"], ["cat", "🐱 Кот"], ["dog", "🐶 Собака"], ["bunny", "🐰 Кролик"]]}
        />
        {avatar.pet !== "none" && (
          <>
            <Colors label="Окрас" value={avatar.petColor} list={PET} onChange={(petColor) => set({ petColor })} />
            <div className="opt-label">Настроение во время музыки</div>
            <Choice<PetMood>
              value={avatar.petMood}
              onChange={(petMood) => set({ petMood })}
              options={[
                ["auto", "Под музыку"],
                ["happy", MOOD_RU.happy],
                ["playful", MOOD_RU.playful],
                ["sleepy", MOOD_RU.sleepy],
                ["sad", MOOD_RU.sad],
              ]}
            />
            <small className="muted">«Под музыку»: питомец сам чувствует настроение воспоминания.</small>
          </>
        )}
      </Section>

      <button className="ghost small reset" onClick={reset}>Сбросить всё</button>
      <p className="credits">
        Авторы 3D-моделей: бумага страниц — «Paper», jacques_3D (CC BY 4.0, sketchfab.com/jacques_3D); фигурка котёнка — «Sims Cat Meme», Sketchfab.
      </p>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="custom-sec">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Colors({ label, value, list, onChange }: { label: string; value: string; list: string[]; onChange: (c: string) => void }) {
  return (
    <div className="colors">
      <div className="opt-label">{label}</div>
      <div className="dots">
        {list.map((c) => (
          <button key={c} aria-label={c} className={c.toLowerCase() === value.toLowerCase() ? "on" : ""} style={{ background: c }} onClick={() => onChange(c)} />
        ))}
        <label className="dot-custom" title="Свой цвет">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          <span style={{ background: value }}>+</span>
        </label>
      </div>
    </div>
  );
}

export type { Avatar };
