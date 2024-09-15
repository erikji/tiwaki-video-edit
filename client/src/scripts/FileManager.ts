import { PromisePool } from "@supercharge/promise-pool";
import type { Ref } from "vue";

export function downloadBlob(data: Blob, filename?: string) {
    const a = document.createElement('a');
    a.setAttribute('download', filename ? filename : '');
    a.href = URL.createObjectURL(data);
    a.click();
    a.remove();
}

export async function upload(files: FileList, percentageRef?: Ref<number | undefined>) {
    const requests: FormData[] = [];
    const requestSize = 50;
    for (const file of files) {
        if (!file.type.startsWith('video') && !file.type.startsWith('image')) continue;
        if (requests.length == 0 || Array.from(requests[requests.length-1].entries()).length >= requestSize) requests.push(new FormData());
        requests[requests.length-1].set(file.webkitRelativePath == '' ? file.name : file.webkitRelativePath, file);
    }
    console.log(requests);
    return new PromisePool(requests).withConcurrency(10).onTaskFinished((request, pool) => {
        if (percentageRef) percentageRef.value = pool.processedPercentage();
    }).process(async (request) => {
        return await fetch('api/upload', {
            method: 'POST',
            body: request
        });
    });
}