import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import { LoginManager } from './login';
import { Database } from './database';
import JSZip from 'jszip';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

const app = express().use(cookieParser());
app.listen(process.env.PORT ?? 6395);
console.log(`Listening on port ${process.env.PORT ?? 6395}`);
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        //not perfect since you can spoof mimetype
        if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png' || file.mimetype == 'image/webp') {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

const loginManager = new LoginManager();
const database = new Database();
const loginCheck = (req, res, next) => {
    if (!req.cookies.token || !loginManager.check(req.cookies.token)) {
        res.sendStatus(401);
        return;
    }
    loginManager.renew(req.cookies.token);
    next();
}

app.post('/api/login', express.urlencoded({ extended: false }), async (req, res) => {
    if (req.body == undefined || typeof req.body.username != 'string' || typeof req.body.password != 'string') {
        res.sendStatus(400);
        return;
    }
    //really bad verification system
    if (await database.checkAccount(req.body.username, req.body.password)) {
        res.cookie('token', loginManager.add(req.body.username, Date.now() + 86400000), { expires: new Date(Date.now() + 86400000) });
        res.redirect('/');
        console.log(`new login from ${req.body.username}`);
    } else {
        res.sendStatus(403);
    }
});

app.get('/api/check', loginCheck);

app.post('/api/shuffle', loginCheck, upload.any(), async (req, res) => {
    if (req.body == null || req.files == null || !Array.isArray(req.files) || !['image/jpeg', 'image/png', 'image/webp'].includes(req.body.mimetype) || !Number.isSafeInteger(Number(req.body.batchSize)) || Number(req.body.batchSize) < 1) {
        res.sendStatus(400);
        return;
    }
    const start = Date.now();
    req.body.batchSize = Number(req.body.batchSize);
    const shuffled = shuffleArray(req.files) as Express.Multer.File[];
    const targetExt = req.body.mimetype.split('/')[1];
    const tasks: Express.Multer.File[][] = [];
    for (const file of shuffled) {
        if (tasks.length == 0 || tasks[tasks.length-1].length == req.body.batchSize) tasks.push([]);
        tasks[tasks.length-1].push(file);
    }
    const zip = new JSZip();
    const promises: Promise<any>[] = [];
    for (const index in tasks) {
        const task = tasks[index];
        let finished = 0;
        for (const file of task) {
            if (file.mimetype != req.body.mimetype) {
                promises.push(new Promise((resolve, reject) => {
                    let buf = Buffer.alloc(0);
                    const targetCodec = targetExt == 'webp' ? 'libwebp' : targetExt == 'png' ? 'png' : targetExt == 'jpeg' ? 'mjpeg' : 'png';
                    ffmpeg(path.resolve(__dirname, '..', file.path)).videoCodec(targetCodec).format('image2').pipe().on('data', (data) => {
                        buf = Buffer.concat([buf, data]);
                    }).on('end', () => {
                        zip.file('task' + (Number(index)+1) + '/' + file.originalname.split('.').slice(0, -1).concat(targetExt).join('.'), buf);
                        finished++;
                        console.log(`zipped file ${finished} of task ${Number(index)+1}`);
                        resolve(true);
                    });
                }));
            } else {
                promises.push(new Promise((resolve, reject) => {
                    zip.file('task' + (Number(index)+1) + '/' + file.originalname, fs.createReadStream(path.resolve(__dirname, '..', file.path)));
                    finished++;
                    console.log(`zipped file ${finished} of task ${Number(index)+1}`);
                    resolve(true);
                }));
            }
        }
    }
    await Promise.all(promises);
    res.setHeader('Content-Type', 'application/zip');
    res.send(await zip.generateAsync({ type: 'nodebuffer' }));
    for (const file of req.files) {
        fs.unlink(path.resolve(__dirname, '..', file.path), () => {});
    }
    console.log(`/shuffle request from ${loginManager.check(req.cookies.token)} took ${Date.now()-start} ms`);
});

const shuffleArray = (arr: any[]) => {
    for (let i = 1; i < arr.length; i++) {
        const index = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[index]] = [arr[index], arr[i]];
    }
    return arr;
}

const indexDir = path.resolve(__dirname, '../../client/dist/index.html');
app.use(express.static(path.resolve(__dirname, '../../client/dist')));
app.get(/^(^[^.\n]+\.?)+(.*(html){1})?$/, (req, res) => {
    if (!req.accepts('html')) res.sendStatus(406);
    else res.sendFile(indexDir);
});
app.get('*', (req, res) => {
    res.status(404);
    if (req.accepts('html')) res.sendFile(indexDir);
    else res.sendStatus(404);
});