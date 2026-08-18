const REDACTED_PATH = "[redacted-local-path]";
const QUOTED_ABSOLUTE_PATH = /(["'])(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/))[^"'\r\n]+\1/g;
const BRACKETED_ABSOLUTE_PATH = /([[(])(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/))[^\s;|<>"'`()[\]{}]+([)\]])/g;
const WINDOWS_PATH = /[A-Za-z]:[\\/][^\s;|<>"'`()[\]{}]+/g;
const UNC_PATH = /\\\\[^\s;|<>"'`()[\]{}]+/g;
const POSIX_PATH = /(^|[\s=:])\/(?!\/)[^\s;|<>"'`()[\]{}]+/gm;
const MARKDOWN_CHARACTERS = ["\\", "`", "|", "[", "]", "(", ")", "!", "*", "#", "+", "_"];

export function safeText(value) {
  let escaped = String(value)
    .replace(QUOTED_ABSOLUTE_PATH, REDACTED_PATH)
    .replace(BRACKETED_ABSOLUTE_PATH, `$1${REDACTED_PATH}$2`)
    .replace(UNC_PATH, REDACTED_PATH)
    .replace(WINDOWS_PATH, REDACTED_PATH)
    .replace(POSIX_PATH, `$1${REDACTED_PATH}`)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  for (const character of MARKDOWN_CHARACTERS) escaped = escaped.replaceAll(character, `\\${character}`);
  return escaped
    .replaceAll("\\[redacted-local-path\\]", REDACTED_PATH)
    .replaceAll(/\r?\n/g, "<br>");
}

export function cell(value) {
  return value === null || value === undefined || value === "" ? "（缺失）" : safeText(value);
}