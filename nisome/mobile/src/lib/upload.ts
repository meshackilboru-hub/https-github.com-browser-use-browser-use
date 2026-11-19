import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { ref, uploadBytesResumable } from "firebase/storage";
import { api } from "./api";
import { storage } from "./firebase";

export type PickedFile = { uri: string; name: string; mimeType: string };

const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function mimeFor(name: string, given?: string | null): string {
  if (given && given !== "application/octet-stream") return given;
  return BY_EXTENSION[name.split(".").pop()?.toLowerCase() ?? ""] ?? given ?? "application/octet-stream";
}

/** PDF, Word, text or image file from the device or cloud drives. */
export async function pickDocument(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: Object.values(BY_EXTENSION),
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const file = { uri: a.uri, name: a.name, mimeType: mimeFor(a.name, a.mimeType) };
  return file.mimeType.startsWith("image/") ? shrinkImage(file) : file;
}

/** A photo of notes, a page or a slide, from the camera or the photo library. */
export async function pickImage(source: "camera" | "library"): Promise<PickedFile | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Allow camera access in Settings to photograph your notes.");
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9 };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return shrinkImage({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg" }, a.width);
}

/** Claude reads images up to 5 MB; 2000 px wide JPEGs keep text sharp and stay well under that. */
async function shrinkImage(file: PickedFile, width?: number): Promise<PickedFile> {
  const ctx = ImageManipulator.manipulate(file.uri);
  if (!width || width > 2000) ctx.resize({ width: 2000 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: out.uri, name: file.name.replace(/\.\w+$/, "") + ".jpg", mimeType: "image/jpeg" };
}

/** Reserves a library slot, uploads the file, and returns the new document's ID. */
export async function uploadFile(file: PickedFile, onProgress: (fraction: number) => void, title?: string): Promise<string> {
  const blob = await (await fetch(file.uri)).blob();
  const { docId, storagePath } = await api.createUpload({ fileName: file.name, mimeType: file.mimeType, sizeBytes: blob.size, title });
  const task = uploadBytesResumable(ref(storage, storagePath), blob, { contentType: file.mimeType });
  await new Promise<void>((resolve, reject) =>
    task.on("state_changed", (s) => onProgress(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve()),
  );
  return docId;
}
