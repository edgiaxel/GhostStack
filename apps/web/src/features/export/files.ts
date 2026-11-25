/** Download-safe file name: letters, digits, dot, dash, underscore and space only. */
export function safeFileName(title: string, extension: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._ -]+/g, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '')
    .slice(0, 80);
  return `${base || 'stack'}${extension}`;
}

/** Saves bytes through the browser download flow. */
export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
