function safeImageSource(value = "") {
  const source = String(value).trim();
  if (!source) return "";
  if (/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(source)) return source;
  if (/^https?:\/\//i.test(source) || /^(?:\.\.\/|\.\/|\/)[^\s]+$/.test(source)) return source;
  return "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire l’image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Format d’image invalide"));
    image.src = source;
  });
}

async function optimizeImageFile(file) {
  if (!file?.type.startsWith("image/")) throw new Error("Sélectionnez un fichier image");
  if (file.size > 12 * 1024 * 1024) throw new Error("L’image dépasse la limite de 12 Mo");
  const original = await readFileAsDataUrl(file);
  if (["image/gif", "image/svg+xml"].includes(file.type)) {
    if (file.size > 2 * 1024 * 1024) throw new Error("Les GIF et SVG doivent faire moins de 2 Mo");
    return original;
  }
  const image = await loadImage(original);
  let scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  let quality = .82;
  let result = original;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    result = canvas.toDataURL("image/webp", quality);
    if (result.length < 900_000) break;
    scale *= .78;
    quality = Math.max(.58, quality - .08);
  }
  return result;
}

export { optimizeImageFile, safeImageSource };
