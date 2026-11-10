export type NavApp = { id: string; name: string; url: string };

const c = (n: number) => n.toFixed(6);

/** Google Xarita: joriy joylashuvdan shu nuqtagacha yo'nalish. */
export function googleRoute(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${c(lat)},${c(lng)}&travelmode=driving`;
}

/** O'zbekistonda ko'p ishlatiladigan navigatorlar. */
export function navApps(lat: number, lng: number): NavApp[] {
  return [
    { id: "yandex-maps", name: "Яндекс Харита", url: `https://yandex.com/maps/?rtext=~${c(lat)},${c(lng)}&rtt=auto` },
    { id: "yandex-navi", name: "Яндекс Навигатор", url: `yandexnavi://build_route_on_map?lat_to=${c(lat)}&lon_to=${c(lng)}` },
    { id: "2gis", name: "2ГИС", url: `dgis://2gis.ru/routeSearch/rsType/car/to/${c(lng)},${c(lat)}` },
    { id: "waze", name: "Waze", url: `https://waze.com/ul?ll=${c(lat)},${c(lng)}&navigate=yes` },
    { id: "apple", name: "Apple Харита (iPhone)", url: `https://maps.apple.com/?daddr=${c(lat)},${c(lng)}&dirflg=d` },
  ];
}
