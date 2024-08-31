export function downloadBlob(data: Blob, filename?: string) {
    const a = document.createElement('a');
    a.setAttribute('download', filename ? filename : '');
    a.href = URL.createObjectURL(data);
    a.click();
    a.remove();
}