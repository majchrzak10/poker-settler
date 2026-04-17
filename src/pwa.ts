/** Ikona + manifest PWA (wcześniej inline w index.html). */
export function injectPwaHead(): void {
  const PWA_ICON_B64 =
    'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiI+CiAgPGRlZnM+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9ImNoaXBHcmFkIiBjeD0iNDAlIiBjeT0iMzUlIiByPSI2MCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMjJjNTVlIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxNDUzMmQiIC8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJiZ0dyYWQiIGN4PSI1MCUiIGN5PSI1MCUiIHI9IjcwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxNjY1MzQiIC8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzA1MmUxNiIgLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8ZmlsdGVyIGlkPSJzaGFkb3ciIHg9Ii0yMCUiIHk9Ii0yMCUiIHdpZHRoPSIxNDAlIiBoZWlnaHQ9IjE0MCUiPgogICAgICA8ZmVEcm9wU2hhZG93IGR4PSIwIiBkeT0iNCIgc3RkRGV2aWF0aW9uPSI4IiBmbG9vZC1jb2xvcj0iIzAwMCIgZmxvb2Qtb3BhY2l0eT0iMC41Ii8+CiAgICA8L2ZpbHRlcj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIGZpbGw9InVybCgjYmdHcmFkKSIgcng9Ijk2Ii8+CiAgPGNpcmNsZSBjeD0iMjU2IiBjeT0iMjU2IiByPSIyMTgiIGZpbGw9IiMxYTFhMGEiIGZpbHRlcj0idXJsKCNzaGFkb3cpIi8+CiAgPGcgZmlsbD0iI2M5YTIyNyI+CiAgICA8cmVjdCB4PSIyNDYiIHk9IjQyIiB3aWR0aD0iMjAiIGhlaWdodD0iMzYiIHJ4PSI0Ii8+CiAgICA8cmVjdCB4PSIyNDYiIHk9IjQzNCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjM2IiByeD0iNCIvPgogICAgPHJlY3QgeD0iNDIiIHk9IjI0NiIgd2lkdGg9IjM2IiBoZWlnaHQ9IjIwIiByeD0iNCIvPgogICAgPHJlY3QgeD0iNDM0IiB5PSIyNDYiIHdpZHRoPSIzNiIgaGVpZ2h0PSIyMCIgcng9IjQiLz4KICAgIDxnIHRyYW5zZm9ybT0icm90YXRlKDQ1IDI1NiAyNTYpIj4KICAgICAgPHJlY3QgeD0iMjQ2IiB5PSI0MiIgd2lkdGg9IjIwIiBoZWlnaHQ9IjM2IiByeD0iNCIvPgogICAgICA8cmVjdCB4PSIyNDYiIHk9IjQzNCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjM2IiByeD0iNCIvPgogICAgICA8cmVjdCB4PSI0MiIgeT0iMjQ2IiB3aWR0aD0iMzYiIGhlaWdodD0iMjAiIHJ4PSI0Ii8+CiAgICAgIDxyZWN0IHg9IjQzNCIgeT0iMjQ2IiB3aWR0aD0iMzYiIGhlaWdodD0iMjAiIHJ4PSI0Ii8+CiAgICA8L2c+CiAgPC9nPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjAwIiBmaWxsPSJ1cmwoI2NoaXBHcmFkKSIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNkNGFmMzciIHN0cm9rZS13aWR0aD0iMTQiLz4KICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSIyNTYiIHI9IjE3MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZDRhZjM3IiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1kYXNoYXJyYXk9IjEyIDgiLz4KICA8cGF0aCBkPSJNIDI1NiAxNDggQyAyNTYgMTQ4LCAxNzUgMTg1LCAxNzUgMjM1IEMgMTc1IDI3MiwgMjEwIDI4OCwgMjM4IDI2OCBDIDI0OCAyOTAsIDIzNiAzMTAsIDIxNiAzMjAgTCAyOTYgMzIwIEMgMjc2IDMxMCwgMjY0IDI5MCwgMjc0IDI2OCBDIDM0MiAyODgsIDMzNyAyNzIsIDMzNyAyMzUgQyAzMzcgMTg1LCAyNTYgMTQ4LCAyNTYgMTQ4IFoiIGZpbGw9IndoaXRlIi8+CiAgPGVsbGlwc2UgY3g9IjIxMCIgY3k9IjE5MCIgcng9IjYwIiByeT0iMzUiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjA4IiB0cmFuc2Zvcm09InJvdGF0ZSgtMjAgMjEwIDE5MCkiLz4KPC9zdmc+';
  const iconHref = 'data:image/svg+xml;base64,' + PWA_ICON_B64;
  const fav = document.createElement('link');
  fav.rel = 'icon';
  fav.type = 'image/svg+xml';
  fav.href = iconHref;
  document.head.appendChild(fav);
  const apple = document.createElement('link');
  apple.rel = 'apple-touch-icon';
  apple.href = iconHref;
  document.head.appendChild(apple);
  const manifest = {
    name: 'Poker Settler',
    short_name: 'Poker',
    description: 'Rozlicz pokera ze znajomymi błyskawicznie',
    start_url: './',
    display: 'standalone',
    background_color: '#052e16',
    theme_color: '#052e16',
    orientation: 'portrait',
    icons: [
      { src: iconHref, sizes: '192x192', type: 'image/svg+xml' },
      { src: iconHref, sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const mLink = document.createElement('link');
  mLink.rel = 'manifest';
  mLink.href = URL.createObjectURL(blob);
  document.head.appendChild(mLink);
}
