export function uploadFile(
    url: Parameters<XMLHttpRequest['open']>[1],
    data: FormData,
    onProgress: (progress: number) => void,
    headers: Record<string, string> = {}
): {
    promise: Promise<string>;
    cancel: () => void;
} {
    const xhr = new XMLHttpRequest();

    const promise = new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) {
                onProgress(e.loaded / e.total);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));
    });

    xhr.open('POST', url, true);
    for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
    }
    xhr.send(data);

    const cancel = () => xhr.abort();

    return { promise, cancel };
}
