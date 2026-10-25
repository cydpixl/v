// Read only the clipboard supplied by a paste event; no clipboard permission prompt.
export function clipboardImages(data) {
  if (!data) return [];
  const images = [];
  for (const item of Array.from(data.items || [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file?.type?.startsWith('image/') && file.size > 0) images.push(file);
  }
  // Browsers can expose the same image in both collections. Do not upload it twice.
  return images.length ? images : Array.from(data.files || []).filter(file => file.type?.startsWith('image/') && file.size > 0);
}

export function screenshotFile(file) {
  if (file.name && !/^(image|clipboard|blob)(\.[a-z0-9]+)?$/i.test(file.name)) return file;
  const extension = ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/bmp':'bmp','image/avif':'avif'})[file.type] || 'png';
  return new File([file], 'Screenshot-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + extension, {type:file.type,lastModified:file.lastModified});
}

export function bindImagePaste(composer, {onImage, onImages, onMultiple = () => {}, onError = () => {}}) {
  const paste = event => {
    const images = clipboardImages(event.clipboardData);
    if (!images.length) return;
    event.preventDefault();
    if (onImages && images.length > 1) { Promise.resolve(onImages(images.map(screenshotFile))).catch(onError); return; }
    if (images.length > 1) onMultiple();
    try { Promise.resolve(onImage(screenshotFile(images[0]))).catch(onError); }
    catch (error) { onError(error); }
  };
  composer.addEventListener('paste', paste);
  return () => composer.removeEventListener('paste', paste);
}
