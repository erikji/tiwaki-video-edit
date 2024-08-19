<script setup lang="ts">
import { ref, watch } from 'vue';
import JSZip from 'jszip';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

const canSubmit = ref(false);
const batchSize = ref(100);
const targetFormat = ref('');
const taskIndex = ref(-1);
const numTasks = ref(-1);
const imageZipIndex = ref(-1);
const imageConvertIndex = ref(-1);
const numZipImages = ref(-1);
const numConvertImages = ref(-1);
const isZipping = ref(false);
const localError = ref('');
const serverError = ref('');

const directoryUpload = ref<HTMLInputElement>();
const handleUpload = (event: Event) => {
    //directoryUpload.value.files has all files, all directories are recursively expanded!
    if (directoryUpload.value?.files && directoryUpload.value?.files.length > 0) {
        canSubmit.value = true;
    }
}

const ffmpeg = new FFmpeg();
// ffmpeg.on("log", ({ message }) => {
//     console.log("[ffmpeg]", message);
// });
const ffmpegBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

const localShuffle = async (event: Event) => {
    try {
        localError.value = '';
        const fileList = directoryUpload.value?.files;
        if (!fileList) throw 'No files uploaded';
        const shuffled = shuffleArray(structuredClone(Array.from(fileList))) as File[];
        const targetExt = targetFormat.value.split('/')[1];

        const tasks: File[][] = [];
        for (const file of shuffled) {
            if (tasks.length == 0 || tasks[tasks.length-1].length == batchSize.value) tasks.push([]);
            tasks[tasks.length-1].push(file);
        }
        numTasks.value = tasks.length;
        const zip = new JSZip();

        for (const index in tasks) {
            const task = tasks[index];
            taskIndex.value = Number(index)+1;
            numZipImages.value = task.length;
            if (targetExt != 'none') {
                ffmpeg.terminate();
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${ffmpegBaseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${ffmpegBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    // workerURL: await toBlobURL(`${ffmpegBaseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
                });
            }
            const loadPromises: Promise<any>[] = [];
            for (const file of task) {
                if (file.type != targetFormat.value && targetExt != 'none') {
                    loadPromises.push(new Promise((resolve, reject) => {
                        fetchFile(file).then(uint8 => {
                            ffmpeg.writeFile(file.name, uint8).then(success => {
                                resolve(success);
                            })
                        })
                    }));
                }
            }
            numConvertImages.value = loadPromises.length;
            await Promise.all(loadPromises);
            
            const runPromises: Promise<any>[] = [];
            imageConvertIndex.value = 0;
            for (const file of task) {
                if (file.type != targetFormat.value && targetExt != 'none') {
                    const targetFilename = file.name.split('.').slice(0, -1).concat(targetExt).join('.');
                    await ffmpeg.exec(['-i', file.name, targetFilename]);
                    const data = ffmpeg.readFile(targetFilename);
                    imageConvertIndex.value++;
                    zip.file('task' + (Number(index)+1) + '/' + targetFilename, data);
                    await ffmpeg.deleteFile(targetFilename);
                    await ffmpeg.deleteFile(file.name);
                } else {
                    zip.file('task' + (Number(index)+1) + '/' + file.name, file.arrayBuffer());
                }
                imageZipIndex.value++;
            }
            await Promise.all(runPromises);

            [imageZipIndex, imageConvertIndex, numZipImages, numConvertImages].forEach(r => {
                r.value = -1;
            });
        };
        isZipping.value = true;
        const zipped = await zip.generateAsync({ type: 'blob' });
        const objectURL = URL.createObjectURL(zipped);
        isZipping.value = false;
        window.open(objectURL);
        console.log(objectURL);
        taskIndex.value = -1;
        numTasks.value = -1;
        isZipping.value = false;
    } catch (error) {
        console.error(error);
        if (typeof error == 'string') {
            localError.value = error;
        } else if (error instanceof Error) {
            localError.value = error.message;
        }
    }
}

const shuffleArray = (arr: any[]) => {
    for (let i = 1; i < arr.length; i++) {
        const index = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[index]] = [arr[index], arr[i]];
    }
    return arr;
}

const shuffle = async (event: Event) => {
    try {
        if (!directoryUpload.value || !directoryUpload.value.files) throw 'No files uploaded';
        const inputs = new FormData();
        inputs.set('mimetype', targetFormat.value);
        inputs.set('batchSize', batchSize.value.toString());
        for (const file of directoryUpload.value.files) {
            inputs.set(file.name, file);
        }
        const res = await fetch('api/shuffle', {
            method: 'POST',
            body: inputs 
        });
        if (!res.ok) {
            serverError.value = res.status + ' ' + res.statusText;
        }
        const objectURL = URL.createObjectURL(await res.blob());
        window.open(objectURL);
        console.log(objectURL);
    } catch (error) {
        console.error(error);
        if (typeof error == 'string') {
            serverError.value = error;
        } else if (error instanceof Error) {
            serverError.value = error.message;
        }
    }
}
</script>

<template>
    <div class="centered">
        <div class="column">
            <input type="file" webkitdirectory @change=handleUpload ref="directoryUpload">
            <label>
                Batch size
                <input type="number" v-model=batchSize min="1" step="1">
            </label>
            <div>
                <label>
                    <input type="radio" v-model=targetFormat value="none/none">
                    No convert
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
            <button :disabled="!canSubmit || !['image/jpeg', 'image/png', 'image/webp'].includes(targetFormat) || !Number.isInteger(batchSize) || batchSize < 1" @click=shuffle>Shuffle on server</button>
            <button :disabled="!canSubmit || !['none/none', 'image/jpeg', 'image/png', 'image/webp'].includes(targetFormat) || !Number.isInteger(batchSize) || batchSize < 1" @click=localShuffle>Shuffle locally</button>
            <p v-show="taskIndex >= 0">Running task {{ taskIndex }} of {{ numTasks }}</p>
            <p v-show="imageZipIndex >= 0">Zipping image {{ imageZipIndex }} of {{ numZipImages }}</p>
            <p v-show="imageConvertIndex >= 0">Converting image {{ imageConvertIndex }} of {{ numConvertImages }}</p>
            <p v-show="isZipping">Zipping</p>
            <p class="error" v-show="localError">Local error: {{ localError }}</p>
            <p class="error" v-show="serverError">Server error: {{ serverError }}</p>
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
</style>