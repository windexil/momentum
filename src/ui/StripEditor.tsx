// Окно выбора снимка для ленты над столом: из галереи телефона или с компьютера.

import { useRef, useState } from "react";
import { STRIP_SLOTS, useRoom } from "../roomStore";

export function StripEditor() {
  const editing = useRoom((s) => s.editing);
  const strip = useRoom((s) => s.strip);
  const edit = useRoom((s) => s.edit);
  const setPhoto = useRoom((s) => s.setStripPhoto);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (editing === null) return null;
  const url = strip[editing];

  return (
    <div className="modal-wrap" onClick={() => edit(null)}>
      <div className="modal strip-editor" onClick={(e) => e.stopPropagation()}>
        <h2>Снимок {editing + 1} из {STRIP_SLOTS}</h2>
        <div className="strip-preview">
          <div className="polaroid big">{url ? <img src={url} alt="" /> : <div className="strip-empty">пусто</div>}</div>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            try {
              await setPhoto(editing, f);
            } finally {
              setBusy(false);
            }
          }}
        />
        <div className="row end">
          {url && (
            <button className="ghost" onClick={() => setPhoto(editing, null)}>
              Убрать
            </button>
          )}
          <button className="ghost" disabled={editing === 0} onClick={() => edit(editing - 1)}>←</button>
          <button className="ghost" disabled={editing === STRIP_SLOTS - 1} onClick={() => edit(editing + 1)}>→</button>
          <button className="primary" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Загружаю…" : url ? "Заменить из галереи" : "Выбрать из галереи"}
          </button>
          <button className="ghost" onClick={() => edit(null)}>Готово</button>
        </div>
      </div>
    </div>
  );
}
