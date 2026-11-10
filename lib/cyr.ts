// Lotin → Kirill (o'zbek). Bazada qiymatlar lotinda saqlanadi, ko'rsatishda shu funksiya o'giradi.
// Lotin -> Kirill (o'zbek). Brend nomlari va ba'zi so'zlar lotincha qoladi.
const PROTECT = new Set(["waze","apple","maps","start","location","mini","esri","openstreetmap","opentopomap","here","garmin","iphone","vercel","blob","url","osm","gps","webhook","token","false","true"]);
const CUSTOM: Record<string, string> = {google:"Гугл",yandex:"Яндекс",telegram:"Телеграм"};
const APOS = "'ʻ‘’`ʼ";
const MAP: Record<string, string> = {a:"а",b:"б",d:"д",e:"е",f:"ф",g:"г",h:"ҳ",i:"и",j:"ж",k:"к",l:"л",m:"м",n:"н",o:"о",p:"п",q:"қ",r:"р",s:"с",t:"т",u:"у",v:"в",x:"х",y:"й",z:"з",c:"к",w:"в"};
function conv(word: string): string {
  let w = word.toLowerCase().replace(/lokats/g,"§");
  let out = "";
  for (let i=0;i<w.length;){
    const c=w[i], n=w[i+1], n2=w[i+2];
    const isApos = (ch?: string) => !!ch && APOS.includes(ch);
    if (c==="§"){out+="локац";i++;continue;}
    if (c==="o" && isApos(n)) {out+="ў";i+=2;continue;}
    if (c==="g" && isApos(n)) {out+="ғ";i+=2;continue;}
    if (c==="s" && n==="h") {out+="ш";i+=2;continue;}
    if (c==="c" && n==="h") {out+="ч";i+=2;continue;}
    if (c==="y" && n==="o" && !isApos(n2)) {out+="ё";i+=2;continue;}
    if (c==="y" && n==="u") {out+="ю";i+=2;continue;}
    if (c==="y" && n==="a") {out+="я";i+=2;continue;}
    if (c==="y" && n==="e") {out+="е";i+=2;continue;}
    if (c==="e" && i===0) {out+="э";i++;continue;}
    if (isApos(c)) {out+="ъ";i++;continue;}
    out += MAP[c] ?? c; i++;
  }
  // katta/kichik harf
  const letters = word.replace(new RegExp("["+APOS+"]","g"),"");
  const allUp = letters.length>1 && letters===letters.toUpperCase();
  if (allUp) return out.toUpperCase();
  if (word[0]===word[0].toUpperCase() && word[0]!==word[0].toLowerCase()) return out[0].toUpperCase()+out.slice(1);
  return out;
}
export function cyr(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(new RegExp("[A-Za-z]+(?:["+APOS+"][A-Za-z]+)*","g"), (w: string, off: number, all: string) => {
    if (all[off-1]==="_"||all[off+w.length]==="_") return w;           // BOT_TOKEN kabi
    if (CUSTOM[w.toLowerCase()]) return CUSTOM[w.toLowerCase()];
    const base = w.split(new RegExp("["+APOS+"]"))[0].toLowerCase();
    if (PROTECT.has(w.toLowerCase())) return w;
    if (PROTECT.has(base) && new RegExp("["+APOS+"]").test(w)) return w; // App'ni kabi: qo'lda tuzatiladi
    return conv(w);
  });
}

