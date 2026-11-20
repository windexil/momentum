// Палитры настроений. Анализатор определяет главное настроение
// воспоминания и красит комнату его палитрой (от светлого к тёмному).

export interface MoodPalette {
  id: string;
  name: string;
  palette: [string, string, string, string, string];
}

/** Порядок цветов: светлый → тёмный (палитра[0] слегка тонирует стены, [4] — фон и тени). */
export const MOODS = {
  calm: { id: "calm", name: "Спокойствие и умиротворение", palette: ["#F4F7F7", "#DCEEF2", "#9EC9CF", "#5B8A94", "#26464D"] },
  cozy: { id: "cozy", name: "Уют и тепло", palette: ["#FAF3E8", "#E8CBB0", "#D49A6A", "#9C5A3C", "#4A2B20"] },
  joy: { id: "joy", name: "Энергия и радость", palette: ["#FFF8D6", "#FFD147", "#FF7A3D", "#F2385A", "#231F20"] },
  romance: { id: "romance", name: "Нежность и романтика", palette: ["#FFF5F7", "#FAD2DC", "#E5A9B8", "#B589B0", "#5C475A"] },
  minimal: { id: "minimal", name: "Строгость и минимализм", palette: ["#FFFFFF", "#EAECEF", "#B0B7C3", "#4A5568", "#1A202C"] },
  drama: { id: "drama", name: "Драма и тайна", palette: ["#E5B8A6", "#B84A62", "#6E2748", "#2E1F3E", "#14121D"] },
  nature: { id: "nature", name: "Свежесть и природа", palette: ["#F3F9F4", "#C7E6CF", "#74B88A", "#2D6A4F", "#1B3B2B"] },
  nostalgia: { id: "nostalgia", name: "Меланхолия и ностальгия", palette: ["#EEF1F5", "#C2CCD6", "#8D99AE", "#5C677D", "#2B2D42"] },
  anger: { id: "anger", name: "Злость и ярость", palette: ["#C91F26", "#6E1418", "#4A4647", "#2B090C", "#0D0D0D"] },
  sadness: { id: "sadness", name: "Грусть и печаль", palette: ["#D3DCE3", "#99AABB", "#5D738A", "#34465A", "#1B2634"] },
  apathy: { id: "apathy", name: "Хандра и апатия", palette: ["#CFCBC4", "#A4A39D", "#7A7D76", "#58555A", "#2F3033"] },
} satisfies Record<string, MoodPalette>;

export type MoodId = keyof typeof MOODS;
