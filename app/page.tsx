import App from "@/components/App";

export default function Page() {
  // Yandex Maps API kaliti (Vercel: Settings -> Environment Variables -> YANDEX_MAPS_KEY).
  // Kalit bo'lmasa, zaxira xarita (Leaflet) ishlatiladi.
  const yandexKey = process.env.YANDEX_MAPS_KEY || process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY || "";
  return <App yandexKey={yandexKey} />;
}
