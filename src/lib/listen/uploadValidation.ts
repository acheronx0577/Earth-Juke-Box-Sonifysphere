export type ListenUploadKind = "image" | "video";

export const LISTEN_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_MEDIA_PIXELS = 50_000_000;
const MAX_MEDIA_SIDE = 8192;
const MAX_VIDEO_SECONDS = 15 * 60;

type SupportedFormat = {
  readonly kind: ListenUploadKind;
  readonly mime: string;
  readonly extension: string;
};

const FORMATS: readonly SupportedFormat[] = [
  { kind: "image", mime: "image/jpeg", extension: ".jpg" },
  { kind: "image", mime: "image/jpeg", extension: ".jpeg" },
  { kind: "image", mime: "image/png", extension: ".png" },
  { kind: "image", mime: "image/webp", extension: ".webp" },
  { kind: "video", mime: "video/mp4", extension: ".mp4" },
  { kind: "video", mime: "video/webm", extension: ".webm" },
];

export class ListenUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListenUploadError";
  }
}

function hasSignature(format: SupportedFormat, bytes: Uint8Array): boolean {
  if (format.mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (format.mime === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (format.mime === "image/webp") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  if (format.mime === "video/mp4") return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

function checkDimensions(width: number, height: number): void {
  if (width < 1 || height < 1 || width > MAX_MEDIA_SIDE || height > MAX_MEDIA_SIDE || width * height > MAX_MEDIA_PIXELS) {
    throw new ListenUploadError("This file is too large to preview. Choose media up to 8,192 pixels on each side and 50 megapixels total.");
  }
}

async function validateImage(file: File): Promise<void> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new ListenUploadError("The image could not be decoded. Choose a valid JPEG, PNG, or WebP image.");
    }
    try {
      checkDimensions(bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
    return;
  }

  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          checkDimensions(image.naturalWidth, image.naturalHeight);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new ListenUploadError("The image could not be decoded. Choose a valid JPEG, PNG, or WebP image."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function validateVideo(file: File): Promise<void> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new ListenUploadError("The video could not be read. Try an MP4 or WebM video that is 15 minutes or shorter.")), 10_000);
      const finish = (callback: () => void) => {
        window.clearTimeout(timeout);
        video.onloadedmetadata = null;
        video.onerror = null;
        callback();
      };

      video.onloadedmetadata = () => finish(() => {
        try {
          checkDimensions(video.videoWidth, video.videoHeight);
          if (!Number.isFinite(video.duration) || video.duration <= 0) {
            throw new ListenUploadError("The video has no readable duration. Choose a finished MP4 or WebM file.");
          }
          if (video.duration > MAX_VIDEO_SECONDS) {
            throw new ListenUploadError("This video is longer than 15 minutes. Choose a shorter clip.");
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      video.onerror = () => finish(() => reject(new ListenUploadError("This video format or codec is not supported. Use an MP4 or WebM video that plays in your browser.")));
      video.src = url;
      video.load();
    });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export async function validateListenUpload(file: File): Promise<{ readonly kind: ListenUploadKind }> {
  if (file.size <= 0) throw new ListenUploadError("The selected file is empty. Choose another file.");

  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  const byExtension = FORMATS.find((format) => format.extension === extension);
  const declaredMime = file.type.trim().toLowerCase();
  const byMime = declaredMime ? FORMATS.find((format) => format.mime === declaredMime) : undefined;
  const format = byMime ?? byExtension;

  if (!format || (declaredMime && !byMime) || (byMime && byExtension && byMime.mime !== byExtension.mime)) {
    throw new ListenUploadError("Use a JPEG, PNG, or WebP image, or an MP4 or WebM video.");
  }

  const limit = format.kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  const limitLabel = format.kind === "image" ? "25 MB" : "100 MB";
  if (file.size > limit) {
    throw new ListenUploadError(`This ${format.kind} is larger than ${limitLabel}. Choose a smaller file.`);
  }

  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasSignature(format, signature)) {
    throw new ListenUploadError("The file contents do not match its type. Choose a valid JPEG, PNG, WebP, MP4, or WebM file.");
  }

  if (format.kind === "image") await validateImage(file);
  else await validateVideo(file);

  return { kind: format.kind };
}
