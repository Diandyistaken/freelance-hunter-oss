"use client";

import { MotionConfig } from "framer-motion";

/**
 * Kök hareket ayarı.
 *
 * `reducedMotion="user"` işletim sisteminde hareketi kısmış kullanıcıda tüm
 * geçişleri kapatır. Daha önce bunun için yazılmış `useHareketAzalt` kancası
 * vardı ama hiçbir yerde import edilmiyordu — ölü koddu ve silindi. Tek
 * doğru yer burası: her ekran otomatik olarak uyar, hiçbir çağrı yeri
 * kendi başına bunu hatırlamak zorunda kalmaz.
 */
export default function Hareket({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
