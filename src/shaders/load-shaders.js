const shaderCache = new Map();

export function loadShaderSource(pathOrUrl, base = import.meta.url) {
  const url = pathOrUrl instanceof URL ? pathOrUrl : new URL(pathOrUrl, base);
  const key = url.href;
  if (!shaderCache.has(key)) {
    const promise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load shader at ${url}`);
        }
        return response.text();
      })
      .then((text) => text.trimStart());
    shaderCache.set(key, promise);
  }
  return shaderCache.get(key);
}
