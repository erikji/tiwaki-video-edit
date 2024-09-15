<script setup lang="ts">
import { ref } from 'vue';
import { downloadBlob, upload } from '@/scripts/FileManager';
import ProcessStatus from '@/components/ProcessStatus.vue';

//form controls
const canSubmitExtract = ref(false);
const batchSize = ref(100);
const fpsNumerator = ref(2);
const fpsDenominator = ref(1);
const targetFormat = ref('');

//errors
const status = ref('');
const error = ref('');
const percentage = ref<number | undefined>();

const extractUpload = ref<HTMLInputElement>();
const handleUpload = () => {
    //extractUpload.value.files has all files, all directories are recursively expanded!
    if (extractUpload.value?.files && extractUpload.value?.files.length > 0) {
        canSubmitExtract.value = true;
    }
}

const extract = async () => {
    try {
        status.value = '';
        error.value = '';
        percentage.value = undefined;
        if (!extractUpload.value || !extractUpload.value.files) throw 'No files uploaded';
        status.value = 'Uploading file';
        const uploadResArray = await upload(extractUpload.value.files, percentage);
        percentage.value = undefined;
        for (const uploadRes of uploadResArray.results) {
            if (!uploadRes.ok) throw 'Upload error: ' + uploadRes.status + ' ' + uploadRes.statusText;
        }
        status.value = 'Extracting';
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
        status.value = 'Downloading';
        downloadBlob(await res.blob(), 'extract.zip');
        status.value = '';
        extractUpload.value.files = null;
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
            <input type="file" @change=handleUpload ref="extractUpload" accept="video/*">
            <label>
                <input type="number" v-model=fpsNumerator min="1" step="1">
                frame{{ fpsNumerator == 1 ? '' : 's' }}
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
            <button :disabled="!canSubmitExtract || !['none/none', 'image/jpeg', 'image/png', 'image/webp'].includes(targetFormat) || !Number.isInteger(batchSize) || batchSize < 1" @click=extract>EXTRACT</button>
            <ProcessStatus :status :error :percentage></ProcessStatus>
            <div class="instructions">
                Instructions:<br>
                1. Upload a video<br>
                2. Set FPS, how many images to extract per second of video<br>
                3. Set image format to convert all images to<br>
                4. Press EXTRACT. May take a long time to upload/download files<br><br>
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