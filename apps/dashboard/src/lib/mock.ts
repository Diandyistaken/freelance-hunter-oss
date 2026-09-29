// Demo verisi — motorlar (services/hunter, services/radar) bağlanana kadar
// arayüzü ayakta tutar. Faz 2'de SQLite + API uçlarıyla değiştirilecek.

export type JobStatus = "firsat" | "uygun" | "suspicious";

export interface Job {
  platform: string;
  market: "global" | "tr";
  lang: string; // ilanın orijinal dili — sistem dil sınırı olmadan tarar
  title: string;
  budget: string;
  deadline: string;
  score: number;
  status: JobStatus;
  reason: string;
  url: string; // ilanın platformdaki adresi — demo verisinde platform listesine gider
}

export const stats = [
  { label: "Bugün Taranan İlan", value: "128", hint: "4 kaynak · tüm diller" },
  { label: "Uygun Eşleşme", value: "7", hint: "1'i 💎 fırsat" },
  { label: "Şüpheli", value: "2", hint: "insan kararı bekliyor" },
  { label: "Radar Avı", value: "5", hint: "web sitesi yok/eski" },
] as const;

export const jobs: Job[] = [
  {
    platform: "Freelancer.com",
    market: "global",
    lang: "AR",
    title: "منصة حجز مواعيد لعيادة أسنان — Diş kliniği için randevu platformu",
    budget: "$3.500 – 5.000",
    deadline: "30 gün",
    score: 95,
    status: "firsat",
    reason:
      "Yüksek bütçe + ödeme doğrulanmış işveren; Arapça ilan Türkçe özetlendi, teklif Arapça hazırlanacak",
    url: "https://www.freelancer.com/jobs/",
  },
  {
    platform: "Freelancer.com",
    market: "global",
    lang: "EN",
    title: "3D scroll-based product landing page",
    budget: "$750 – 1.500",
    deadline: "14 gün",
    score: 92,
    status: "uygun",
    reason: "Portfolio projesiyle birebir örtüşüyor (Next.js + Framer Motion)",
    url: "https://www.freelancer.com/jobs/website-design/",
  },
  {
    platform: "Upwork · e-posta",
    market: "global",
    lang: "EN",
    title: "AI email triage agent for a small agency",
    budget: "$40/saat",
    deadline: "sürekli",
    score: 88,
    status: "uygun",
    reason: "Kisisel Ajan (Gmail API) doğrudan referans",
    url: "https://www.upwork.com/nx/search/jobs/?q=ai%20email%20agent",
  },
  {
    platform: "Bionluk",
    market: "tr",
    lang: "TR",
    title: "Kurumsal web sitesi yenileme + mobil uyum",
    budget: "₺18.000",
    deadline: "10 gün",
    score: 76,
    status: "uygun",
    reason: "Şablon kütüphanesinden hızlı teslim edilebilir",
    url: "https://bionluk.com/",
  },
  {
    platform: "Freelancer.com",
    market: "global",
    lang: "EN",
    title: "Urgent!! Crypto wallet recovery tool",
    budget: "$3.000",
    deadline: "2 gün",
    score: 31,
    status: "suspicious",
    reason: "Gerçekdışı bütçe + aciliyet baskısı + kripto 'kurtarma' kalıbı",
    url: "https://www.freelancer.com/jobs/",
  },
];

export const radarHits = [
  {
    name: "Nitro Barbershop",
    district: "Kadıköy",
    issue: "Web sitesi yok — sadece Google kaydı",
    opened: "2 ay önce açıldı",
    score: 86,
  },
  {
    name: "Lezzet Durağı Lokantası",
    district: "Üsküdar",
    issue: "Site 2016'dan kalma, mobil uyumsuz",
    opened: "—",
    score: 78,
  },
  {
    name: "FitZone Studio",
    district: "Ataşehir",
    issue: "Sadece Instagram, rezervasyon manuel",
    opened: "6 ay önce açıldı",
    score: 74,
  },
];
