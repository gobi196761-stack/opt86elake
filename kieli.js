// Kielivalinta selaimessa: kääntää sivun tekstit (myös myöhemmin lisätyt), ilmoitusikkunat
// ja lisää oikeaan yläkulmaan toisen kielen lipun, kuten melontasivuilla.
// Ladataan ennen script.js:ää, jotta ilmoitusikkunat ovat jo käännettyjä.
import { kaanna, valitseKieli } from './lib/kieli.js';

const TALLENNUS = "kieli";
const lue = () => { try { return localStorage.getItem(TALLENNUS); } catch { return null; } };

export const kieli = valitseKieli(location.search, lue());
try { localStorage.setItem(TALLENNUS, kieli); } catch { /* yksityinen ikkuna */ }

export const t = teksti => kaanna(teksti, kieli);
export const paikallinen = kieli === "fi" ? "fi-FI" : "en-GB";

const LIPUT = {
  en: '<svg viewBox="0 0 60 30" width="28" height="14" aria-hidden="true">' +
      '<clipPath id="uk-a"><path d="M0,0v30h60v-30z"/></clipPath>' +
      '<clipPath id="uk-b"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>' +
      '<g clip-path="url(#uk-a)"><path d="M0,0v30h60v-30z" fill="#012169"/>' +
      '<path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>' +
      '<path d="M0,0L60,30M60,0L0,30" clip-path="url(#uk-b)" stroke="#C8102E" stroke-width="4"/>' +
      '<path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>' +
      '<path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></g></svg>',
  fi: '<svg viewBox="0 0 18 11" width="23" height="14" aria-hidden="true">' +
      '<rect width="18" height="11" fill="#fff"/><rect x="5" width="3" height="11" fill="#002f6c"/>' +
      '<rect y="4" width="18" height="3" fill="#002f6c"/></svg>',
};

document.documentElement.lang = kieli;

if (kieli !== "en") {
  // Ilmoitusikkunat
  const [alert0, confirm0, prompt0] = [window.alert, window.confirm, window.prompt];
  window.alert = viesti => alert0.call(window, t(String(viesti)));
  window.confirm = viesti => confirm0.call(window, t(String(viesti)));
  window.prompt = (viesti, oletus) => prompt0.call(window, t(String(viesti)), oletus);

  // Tekstisolmut ja näkyvät attribuutit; translate="no" (esim. chat-viestit) jätetään ennalleen
  const ATTRIBUUTIT = ["placeholder", "title", "aria-label"];
  const ohita = el => !el || el.closest("script, style, textarea, [translate='no']");
  const kaannaSolmu = solmu => {
    if (solmu.nodeType === Node.TEXT_NODE) {
      if (ohita(solmu.parentElement)) return;
      const uusi = t(solmu.data);
      if (uusi !== solmu.data) solmu.data = uusi;
    } else if (solmu.nodeType === Node.ELEMENT_NODE) {
      if (ohita(solmu)) return;
      for (const a of ATTRIBUUTIT) {
        const arvo = solmu.getAttribute(a);
        if (arvo) { const uusi = t(arvo); if (uusi !== arvo) solmu.setAttribute(a, uusi); }
      }
      solmu.childNodes.forEach(kaannaSolmu);
    }
  };
  const kaannaOtsikko = () => { const uusi = t(document.title); if (uusi !== document.title) document.title = uusi; };

  kaannaOtsikko();
  kaannaSolmu(document.body);
  new MutationObserver(muutokset => {
    for (const m of muutokset) {
      if (m.type === "childList") m.addedNodes.forEach(kaannaSolmu);
      else if (m.type === "characterData") kaannaSolmu(m.target);
      else kaannaSolmu(m.target);
    }
    kaannaOtsikko();
  }).observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUUTIT,
  });
}

// Kielen vaihto: toisen kielen lippu oikeassa yläkulmassa
const toinen = kieli === "fi" ? "en" : "fi";
const vaihto = document.createElement("a");
vaihto.className = "kielivalinta";
vaihto.href = `?kieli=${toinen}${location.hash}`;
vaihto.hreflang = toinen;
vaihto.lang = toinen;
vaihto.title = toinen === "fi" ? "Suomeksi" : "In English";
vaihto.setAttribute("aria-label", vaihto.title);
vaihto.setAttribute("translate", "no");
vaihto.innerHTML = LIPUT[toinen];
vaihto.style.cssText = "position:absolute; top:10px; right:10px; z-index:10; display:inline-flex; padding:6px; line-height:0;";
vaihto.querySelector("svg").style.cssText = "border:1px solid #ccc; border-radius:2px; display:block;";
document.body.appendChild(vaihto);
