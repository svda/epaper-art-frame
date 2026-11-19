import type { Photo, PhotoSource } from "./photo-source.ts";

// Videos and Live-Photo movies are excluded; undated photos sort last. Ties on capture date
// are broken deterministically by uuid (ascending).
export function selectAlbum(source: PhotoSource, album: string): Photo[] {
  return source
    .list(album)
    .filter((photo) => !photo.isMovie)
    .sort((a, b) => {
      if (a.date && b.date && a.date.getTime() !== b.date.getTime()) {
        return b.date.getTime() - a.date.getTime();
      }
      if (Boolean(a.date) !== Boolean(b.date)) return a.date ? -1 : 1;
      return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
    });
}
