/* Only app-authored text is translated, never user data. */
const PicoI18n = (() => {
  const english = typeof PicoEnglish !== "undefined" ? PicoEnglish : typeof require === "function" ? require("./i18n.en.js") : {};
  const storageKey = "picoblocks-language-v1";
  let language = "ja";
  try { if (localStorage.getItem(storageKey) === "en") language = "en"; } catch {}
  const locales = {};
  const textNodes = [], attributes = [];
  function t(message, ...values) {
    if (typeof message === "string") return language === "en" ? english[message] ?? message : message;
    const key = message.map((part, i) => part + (i < values.length ? `{${i}}` : "")).join("");
    const pattern = language === "en" ? english[key] ?? key : key;
    // Replace template placeholders once; never reprocess interpolated values.
    return pattern.replace(/\{(\d+)\}/g, (whole, index) => Number(index) < values.length ? String(values[index]) : whole);
  }
  function captureBlockly(locale, messages) { locales[locale] = {...messages}; }
  function setLanguage(next) {
    language = next === "en" ? "en" : "ja";
    try { localStorage.setItem(storageKey, language); } catch {}
    if (typeof Blockly !== "undefined" && locales[language]) Blockly.setLocale(locales[language]);
  }
  function bindDocument(document) {
    const walker = document.createTreeWalker(document, 4);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest("script,style,textarea,#blocklyDiv")) continue;
      const original = node.nodeValue, key = original.trim();
      if (Object.hasOwn(english, key)) textNodes.push({node, key, before: original.match(/^\s*/)[0], after: original.match(/\s*$/)[0], last: original});
    }
    for (const node of document.querySelectorAll("*")) {
      for (const attr of node.attributes) if (Object.hasOwn(english, attr.value)) attributes.push({node, name: attr.name, key: attr.value});
    }
    renderDocument(document);
  }
  function renderDocument(document) {
    document.documentElement.lang = language;
    for (const item of textNodes) {
      // Dynamic content (serial logs, generated code, etc.) belongs to its renderer.
      if (item.node.isConnected && item.node.nodeValue === item.last) {
        item.last = item.before + t(item.key) + item.after;
        item.node.nodeValue = item.last;
      }
    }
    for (const item of attributes) if (item.node.isConnected) item.node.setAttribute(item.name, t(item.key));
    const select = document.querySelector("#languageSelect");
    if (select) select.value = language;
    const guide = document.querySelector("#exchangeGuideLink");
    if (guide) guide.href = `https://github.com/pscmps/pico-blocks-studio/blob/main/AI_GUIDE${language === "en" ? ".en" : ""}.md`;
  }
  return {t, setLanguage, captureBlockly, bindDocument, renderDocument, get language() {return language;}, english};
})();
globalThis.PicoI18n = PicoI18n;
if (typeof module !== "undefined") module.exports = PicoI18n;
