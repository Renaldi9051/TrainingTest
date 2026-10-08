import { ApiError, isApiErrorBody } from "./client";
import type { ApiSuccess } from "./types";

// Upload multipart dengan progress. fetch belum mendukung progress upload, jadi memakai XHR.
// Browser mengirim header Origin otomatis (dicek BE untuk request mutasi).
export function uploadWithProgress<TData>(
  path: string,
  body: FormData,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ApiSuccess<TData>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const response: unknown = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(response as ApiSuccess<TData>);
        return;
      }
      if (isApiErrorBody(response)) {
        const { code, message, fields, details } = response.error;
        reject(new ApiError(xhr.status, code, message, fields, details));
        return;
      }
      reject(new ApiError(xhr.status, "UNKNOWN_ERROR", "Upload gagal. Coba lagi."));
    };
    xhr.onerror = () =>
      reject(new ApiError(0, "NETWORK_ERROR", "Tidak dapat terhubung ke server. Coba lagi."));
    xhr.onabort = () => reject(new ApiError(0, "ABORTED", "Upload dibatalkan."));

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}
