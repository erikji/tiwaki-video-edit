<script setup lang="ts">
import { ref } from 'vue';
import JSZip from 'jszip';
import { downloadBlob, upload } from '@/scripts/FileManager';
import ProcessStatus from '@/components/ProcessStatus.vue';

//form controls
const canSubmit = ref(false);
const batchSize = ref(100);
const targetFormat = ref('');

//errors
const status = ref('');
const error = ref('');
const percentage = ref<number | undefined>();

const shuffleUpload = ref<HTMLInputElement>();
const handleUpload = () => {
    //shuffleUpload.value.files has all files, all directories are recursively expanded!
    if (shuffleUpload.value?.files && shuffleUpload.value?.files.length > 0) {
        canSubmit.value = true;
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
        status.value = `Zipping task ${index+1} of ${tasks.length}`;
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
    status.value = 'Downloading';
    return zip.generateAsync({ type: 'blob' });
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
        status.value = '';
        error.value = '';
        percentage.value = undefined;
        if (!shuffleUpload.value || !shuffleUpload.value.files) throw 'No files uploaded';
        status.value = 'Uploading files';
        if (targetFormat.value == 'none/none') {
            downloadBlob(await localShuffle());
        } else {
            const uploadResArray = await upload(shuffleUpload.value.files, percentage);
            percentage.value = undefined;
            for (const uploadRes of uploadResArray.results) {
                if (!uploadRes.ok) throw 'Upload error: ' + uploadRes.status + ' ' + uploadRes.statusText;
            }
            status.value = 'Converting and shuffling';
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
            status.value = 'Downloading';
            downloadBlob(await res.blob(), 'shuffle.zip');
        }
        status.value = '';
        shuffleUpload.value.files = null;
    } catch (e) {
        console.error(e);
        if (typeof e == 'string') {
            error.value = e;
        } else if (e instanceof Error) {
            error.value = e.message;
        }
    }
}
</script>

<template>
    <div class="centered">
        <div class="column">
            <input type="file" webkitdirectory @change=handleUpload ref="shuffleUpload">
            <label>
                Batch size
                <input type="number" v-model=batchSize min="1" step="1">
            </label>
            <div class="column radioContainer">
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
            <button :disabled="!canSubmit || !['none/none', 'image/jpeg', 'image/png', 'image/webp'].includes(targetFormat) || !Number.isInteger(batchSize) || batchSize < 1" @click=shuffle>SHUFFLE</button>
            <ProcessStatus :status :error :percentage></ProcessStatus>
            <div class="instructions">
                Instructions:<br>
                1. Upload a directory<br>
                2. Set batch size, how many images to put in each sub-folder<br>
                3. Set image format to convert all images to, or leave as original format<br>
                4. Press SHUFFLE. May take a long time to upload/download files<br><br>
            </div>
        </div>
    </div>
</template>

<style scoped>
.radioContainer {
    align-items: start;
}

input[type=number] {
    width: 80px;
}

.instructions {
    text-align: left;
}

.instructions p {
    margin: 0 0 0 4px;
}
</style>