// JSON.stringify already escapes control characters; Python's ensure_ascii also escapes
// DEL and everything above, as \uXXXX per UTF-16 unit.
export function escapeNonAscii(json: string): string {
  return json.replace(
    /[\u007f-\uffff]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
