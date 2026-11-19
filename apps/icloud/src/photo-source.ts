export interface Photo {
  uuid: string;
  date: Date | null;
  filename: string;
  isMovie: boolean;
  adjusted: boolean;
  localPath: string | null;
}

export interface PhotoSource {
  list(album: string): Photo[];
}
