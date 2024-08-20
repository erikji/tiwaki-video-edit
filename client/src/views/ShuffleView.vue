<script setup lang="ts">
import { ref, type Ref } from 'vue';
import JSZip from 'jszip';
import { PromisePool } from '@supercharge/promise-pool';

//form controls
const canSubmitShuffle = ref(false);
const canSubmitExtract = ref(false);
const batchSize = ref(100);
const fpsNumerator = ref(2);
const fpsDenominator = ref(1);
const targetFormat = ref('');

//errors
const extractStatus = ref('');
const extractError = ref('');
const shuffleStatus = ref('');
const shuffleError = ref('');

const extractUpload = ref<HTMLInputElement>();
const handleUploadExtract = () => {
    //extractUpload.value.files has all files, all directories are recursively expanded!
    if (extractUpload.value?.files && extractUpload.value?.files.length > 0) {
        canSubmitExtract.value = true;
    }
}

const extract = async () => {
    try {
        extractStatus.value = '';
        if (!extractUpload.value || !extractUpload.value.files) throw 'No files uploaded';
        extractStatus.value = 'Uploading file...';
        const uploadResArray = await upload(extractUpload.value.files, extractStatus);
        for (const uploadRes of uploadResArray.results) {
            if (!uploadRes.ok) throw 'Upload error: ' + uploadRes.status + ' ' + uploadRes.statusText;
        }
        const res = await fetch('api/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fps: fpsNumerator.value / fpsDenominator.value,
                file: extractUpload.value.files[0].name,
                mimetype: targetFormat.value
            })
        });
        if (!res.ok) {
            throw 'Extract error: ' + res.status + ' ' + res.statusText;
        }
        extractStatus.value = 'Downloading...';
        const objectURL = URL.createObjectURL(await res.blob());
        window.open(objectURL);
        console.log(objectURL);
        extractStatus.value = '';
        extractUpload.value.files = null;
    } catch (e) {
        console.error(e);
        if (typeof e == 'string') {
            extractError.value = e;
        } else if (e instanceof Error) {
            extractError.value = e.message;
        }
    }
}

const shuffleUpload = ref<HTMLInputElement>();
const handleUploadShuffle = () => {
    //shuffleUpload.value.files has all files, all directories are recursively expanded!
    if (shuffleUpload.value?.files && shuffleUpload.value?.files.length > 0) {
        canSubmitShuffle.value = true;
    }
}

//only shuffle, no converting which is too slow with ffmpeg.wasm
const localShuffle = async () => {
    const shuffled = shuffleArray(structuredClone(Array.from(shuffleUpload.value!.files!))) as File[];
    const tasks: File[][] = [];
    for (const file of shuffled) {
        if (tasks.length == 0 || tasks[tasks.length-1].length == batchSize.value) tasks.push([]);
        tasks[tasks.length-1].push(file);
    }
    const zip = new JSZip();

    for (const index in tasks) {
        shuffleStatus.value = `Zipping task ${index+1} of ${tasks.length}`;
        const task = tasks[index];
        const zipPromises: Promise<any>[] = [];
        for (const file of task) {
            zipPromises.push(new Promise((resolve, reject) => {
                zip.file('task' + (Number(index)+1) + '/' + file.name, file.arrayBuffer());
                resolve(true);
            }));
        }
        await Promise.all(zipPromises);
    };
    shuffleStatus.value = 'Generating download link...';
    const zipped = await zip.generateAsync({ type: 'blob' });
    return URL.createObjectURL(zipped);
}

const shuffleArray = (arr: any[]) => {
    for (let i = 1; i < arr.length; i++) {
        const index = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[index]] = [arr[index], arr[i]];
    }
    return arr;
}

const shuffle = async () => {
    try {
        shuffleStatus.value = '';
        if (!shuffleUpload.value || !shuffleUpload.value.files) throw 'No files uploaded';
        shuffleStatus.value = 'Uploading files...';
        let objectURL: string;
        if (targetFormat.value == 'none/none') {
            objectURL = await localShuffle();
        } else {
            const uploadResArray = await upload(shuffleUpload.value.files, shuffleStatus);
            for (const uploadRes of uploadResArray.results) {
                if (!uploadRes.ok) throw 'Upload error: ' + uploadRes.status + ' ' + uploadRes.statusText;
            }
            shuffleStatus.value = 'Converting and shuffling...';
            const res = await fetch('api/shuffle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mimetype: targetFormat.value,
                    batchSize: batchSize.value,
                    files: Array.from(shuffleUpload.value.files).filter(f => f.type.startsWith('image')).map(file => file.webkitRelativePath)
                })
            });
            if (!res.ok) {
                throw 'Shuffle error: ' + res.status + ' ' + res.statusText;
            }
            shuffleStatus.value = 'Downloading... (this could take a long time)';
            objectURL = URL.createObjectURL(await res.blob());
        }
        window.open(objectURL);
        console.log(objectURL);
        shuffleStatus.value = '';
        shuffleUpload.value.files = null;
    } catch (e) {
        console.error(e);
        if (typeof e == 'string') {
            shuffleError.value = e;
        } else if (e instanceof Error) {
            shuffleError.value = e.message;
        }
    }
}

const upload = async (files: FileList, statusRef: Ref<string>) => {
    const requests: FormData[] = [];
    const requestSize = 50;
    for (const file of files) {
        if (!file.type.startsWith('video') && !file.type.startsWith('image')) continue;
        if (requests.length == 0 || Array.from(requests[requests.length-1].entries()).length >= requestSize) requests.push(new FormData());
        requests[requests.length-1].set(file.webkitRelativePath == '' ? file.name : file.webkitRelativePath, file);
    }
    console.log(requests);
    return new PromisePool(requests).withConcurrency(10).onTaskFinished((request, pool) => {
        statusRef.value = 'Uploading files ' + Math.round(pool.processedPercentage() * 10) / 10 + '%';
    }).process(async (request) => {
        return await fetch('api/upload', {
            method: 'POST',
            body: request
        });
    });
}
</script>

<template>
    <div class="centered">
        <div class="column">
            <input type="file" @change=handleUploadExtract ref="extractUpload" accept="video/*">
            <label>
                <input type="number" v-model=fpsNumerator min="1" step="1">
                image{{ fpsNumerator == 1 ? '' : 's' }}
            </label>
            per
            <label>
                <input type="number" v-model=fpsDenominator min="1" step="1">
                second{{ fpsDenominator == 1 ? '' : 's' }}
            </label>
            ={{ Math.round((fpsNumerator / fpsDenominator) * 10) / 10 }} FPS
            <div class="column radioContainer">
                <label>
                    <input type="radio" v-model=targetFormat value="image/jpeg">
                    JPEG
                </label>
                <label>
                    <input type="radio" v-model=targetFormat value="image/png">
                    PNG
                </label>
                <label>
                    <input type="radio" v-model=targetFormat value="image/webp">
                    WEBP
                </label>
            </div>
            <button :disabled="!canSubmitExtract || !['none/none', 'image/jpeg', 'image/png', 'image/webp'].includes(targetFormat) || !Number.isInteger(batchSize) || batchSize < 1" @click=extract>Extract</button>
            <p>{{ extractStatus }}</p>
            <p class="error">{{ extractError }}</p>
        </div>
        <div class="column">
            <input type="file" webkitdirectory @change=handleUploadShuffle ref="shuffleUpload">
            <label>
                Batch size
                <input type="number" v-model=batchSize min="1" step="1">
            </label>
            <div class="column radioContainer">
                <label>
                    <input type="radio" v-model=targetFormat value="none/none">
                    No convert (local)
                </label>
                <label>
                    <input type="radio" v-model=targetFormat value="image/jpeg">
                    JPEG
                </label>
                <label>
                    <input type="radio" v-model=targetFormat value="image/png">
                    PNG
                </label>
                <label>
                    <input type="radio" v-model=targetFormat value="image/webp">
                    WEBP
                </label>
            </div>
            <button :disabled="!canSubmitShuffle || !['none/none', 'image/jpeg', 'image/png', 'image/webp'].includes(targetFormat) || !Number.isInteger(batchSize) || batchSize < 1" @click=shuffle>Shuffle</button>
            <p>{{ shuffleStatus }}</p>
            <p class="error">{{ shuffleError }}</p>
        </div>
    </div>
</template>

<style scoped>
p {
    margin: 0;
}

.error {
    color: red;
}

.radioContainer {
    align-items: start;
}

input[type=number] {
    width: 80px;
}
</style>