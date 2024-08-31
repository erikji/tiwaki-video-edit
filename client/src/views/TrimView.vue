<script setup lang="ts">
import { downloadBlob } from '@/scripts/DownloadManager';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { ref } from 'vue';

const stage = ref<HTMLDivElement>();
const upload = ref<HTMLInputElement>();
const videoSource = ref<HTMLVideoElement>();
const videoURL = ref('');
const videoType = ref('');
const videoZoom = ref(1);
const videoX = ref(0);
const videoY = ref(0);
const videoPaused = ref(true);
const videoTime = ref(0);
const videoLength = ref(0);
const trimStart = ref(0);
const trimEnd = ref(0);
const status = ref('');
const error = ref('');

const ffmpeg = new FFmpeg();
const ffmpegBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

const trim = async () => {
    try {
        status.value = '';
        error.value = '';
        if (!upload.value || !upload.value.files) return;
        if (!ffmpeg.loaded) {
            await ffmpeg.load({
                coreURL: await toBlobURL(`${ffmpegBaseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${ffmpegBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                // workerURL: await toBlobURL(`${ffmpegBaseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
            });
        }
        const file = upload.value!.files![0];
        const inputExt = file.name.split('.').slice(-1).join('.');
        const outputFilename = file.name.split('.').slice(0, -1).join('.').concat('_trimmed.', inputExt);
        await ffmpeg.writeFile(file.name, await fetchFile(file));
        const ops = ['-c', 'copy'];
        if (trimStart.value >= 0) {
            ops.push('-ss', trimStart.value.toString());
        }
        if (trimEnd.value >= 0) {
            ops.push('-to', trimEnd.value.toString());
        }
        status.value = 'Trimming...';
        ffmpeg.on('progress', (event) => {
            status.value = `Trimming... ${event.progress*100}%`;
        })
        await ffmpeg.exec(['-i', file.name].concat(ops, outputFilename));
        status.value = 'Generating download link...';
        downloadBlob(new Blob([await ffmpeg.readFile(outputFilename)]), outputFilename);
        status.value = '';
    } catch (e) {
        console.error(e);
        if (typeof e == 'string') {
            error.value = e;
        } else if (e instanceof Error) {
            error.value = e.message;
        }
    }
}

const scrollZoom = (e: WheelEvent) => {
    console.log(e);
    e.preventDefault();
    const rect = stage.value?.getBoundingClientRect();
    if (!rect) return;
    //center of click, in coordinates relative to video viewport
    const zoomFactor = 1 - (e.deltaY / 200);
    const offsetX = (e.pageX - rect?.left) / videoZoom.value + videoX.value;
    const offsetY = (e.pageY - rect?.top) / videoZoom.value + videoY.value;
    videoX.value = ((videoX.value - offsetX) / zoomFactor) + offsetX;
    videoY.value = ((videoY.value - offsetY) / zoomFactor) + offsetY;
    videoZoom.value *= zoomFactor;
}

//reactivity doesn't work if you put this in v-bind css
const loadMetadata = () => {
    if (!stage.value || !videoSource.value) return;
    stage.value.style.width = '60vw'
    stage.value.style.height = `calc(60vw * ${videoSource.value.videoHeight / videoSource.value.videoWidth})`;
    videoLength.value = videoSource.value.duration;
}

const handleUpload = async () => {
    try {
        if (!upload.value || !upload.value.files) throw 'No files uploaded';
        videoURL.value = URL.createObjectURL(upload.value.files[0]);
        videoType.value = upload.value.files[0].type;
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
            <input type="file" @change=handleUpload ref="upload" accept="video/*">
            <div class="centered row">
                <div class="stage" ref="stage" @wheel=scrollZoom @click="videoSource?.paused ? videoSource?.play() : videoSource?.pause()">
                    <video disablePictureInPicture muted ref="videoSource" :src="videoURL" :type="videoType" @loadedmetadata=loadMetadata 
                    @play="() => videoPaused = false"
                    @pause="() => videoPaused = true"
                    @timeupdate="() => videoTime = videoSource!.currentTime"
                    >Video playback disabled</video>
                </div>
                <div class="column">
                    Start time (seconds):
                    <div class="row">
                        <input type="number" min="-1" v-model="trimStart">
                        <button @click="() => trimStart = Math.floor(videoTime)">Set to now</button>
                        <button @click="() => trimStart = -1">Set to beginning</button>
                    </div>
                    End time (seconds):
                    <div class="row">
                        <input type="number" min="-1" v-model="trimEnd">
                        <button @click="() => trimEnd = Math.ceil(videoTime)">Set to now</button>
                        <button @click="() => trimEnd = -1">Set to end</button>
                    </div>
                    <div class="centered row"><button @click="trim" :disabled="videoLength <= 0">TRIM</button></div>
                </div>
            </div>
            <div class="row videoControls">
                <button @click="() => videoSource!.currentTime -= 5">
                    -5
                </button>
                <button v-show="videoPaused" @click="videoSource?.play()">
                    <img src="../assets/play.svg">
                </button>
                <button v-show="!videoPaused" @click="videoSource?.pause()">
                    <img src="../assets/pause.svg">
                </button>
                <button @click="() => videoSource!.currentTime += 5">
                    +5
                </button>
                <input type="range" size="1" min="0" :max="videoLength" @change="() => videoSource!.currentTime = videoTime" v-model="videoTime" class="seeker">
                <button :disabled="videoZoom == 1 && videoX == 0 && videoY == 0"
                @click="() => {
                    videoZoom = 1;
                    videoX = 0;
                    videoY = 0;
                }"><img src="../assets/zoom.svg"></button>
            </div>
            <p>{{ status }}</p>
            <p class="error">{{ error }}</p>
        </div>
    </div>
</template>

<style scoped>
.error {
    color: red;
}

.videoControls {
    margin-top: 4px;
    width: 60vw;
    gap: 4px;
}

input[type=number] {
    width: 60px;
}

button {
    background-color: transparent;
    border: 1px solid black;
    transition: 200ms ease-out background-color;
    padding: 2px 8px;
    height: 16px;
    width: min-content;
    box-sizing: content-box;
    text-wrap: nowrap;
}

button * {
    height: 100%;
    width: min-content;
}

button:hover {
    background-color: rgba(0,0,0,0.1);
    cursor: pointer;
}

button:disabled {
    background-color: rgba(0,0,0,0.2);
    cursor: not-allowed;
}

.seeker {
    width: 100%;
}

.stage {
    overflow: hidden;
    background-color: lightgray;
}

video {
    width: 100%;
    transform: scale(v-bind("videoZoom")) translate(v-bind("-videoX + 'px'"), v-bind("-videoY + 'px'"));
    transform-origin: 0px 0px;
}
</style>