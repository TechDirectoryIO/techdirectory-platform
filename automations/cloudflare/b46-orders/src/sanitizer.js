// A DOMPurify-shaped cleaner for the Worker (no browser DOM there).
// The checks file calls sanitizer.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP });
// this does the same job with js-xss: tags not on the list are removed, the
// contents of script-like tags are dropped, and only safe link and image addresses stay.
import { FilterXSS } from "xss";

const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "form", "noscript", "template", "svg", "math"];

export const workerSanitizer = {
  isSupported: true,
  sanitize(html, cfg) {
    const uriOk = cfg.ALLOWED_URI_REGEXP || /^(?:https?:|\/|#)/i;
    const whiteList = {};
    for (const tag of cfg.ALLOWED_TAGS) {
      whiteList[tag] = tag === "a" ? ["href"] : tag === "img" ? ["src", "alt"] : [];
    }
    const f = new FilterXSS({
      whiteList,
      stripIgnoreTag: true,
      stripIgnoreTagBody: DROP_WITH_CONTENT,
      allowCommentTag: false,
      css: false,
      safeAttrValue(tag, name, value) {
        const v = String(value || "").trim();
        if (name === "href" || name === "src") return uriOk.test(v) ? v.replace(/"/g, "%22") : "";
        return v.replace(/[<>"]/g, "");
      },
    });
    return f.process(String(html || ""));
  },
};
