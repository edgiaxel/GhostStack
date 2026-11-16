export const SUPPORTED_FORMAT_VERSIONS = [1] as const;

export const GSP_LIMITS = {
  maxArchiveBytes: 52_428_800,
  maxEntryBytes: 26_214_400,
  maxTotalBytes: 104_857_600,
  maxEntries: 1000,
  maxRatio: 100,
  ratioMinEntryBytes: 1_048_576,
  inflateChunkBytes: 16_384,
} as const;

// Local-time constructor: fflate reads local fields, so the written DOS time is the same in every time zone.
export const FIXED_ZIP_TIME = new Date(1980, 0, 1, 0, 0, 0);
