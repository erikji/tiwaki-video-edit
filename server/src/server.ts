import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'node:path';
import { LoginManager } from './login.js';
import { Database } from './database.js';
import archiver from 'archiver';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import { PromisePool } from '@supercharge/promise-pool';
import { fileTypeFromFile } from 'file-type';
import mime from 'mime';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const uploadDir = 'uploads/';
const app = express().use(cookieParser());
app.listen(process.env.PORT ?? 6395);
console.log(`Listening on port ${process.env.PORT ?? 6395}`);
const upload = multer({ 
    storage: multer.diskStorage({ 
        destination: uploadDir,
        filename: (req, file, cb) => {
            if (file.fieldname == null) {
                cb(new Error('No filename'), '');
            }
            const targetFilename = path.join(loginManager.check(req.cookies.token)!, file.fieldname);
            fs.mkdirSync(path.resolve(__dirname, '..', uploadDir, targetFilename).split('/').slice(0, -1).join('/'), { recursive: true });
            cb(null, targetFilename);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

const loginManager = new LoginManager();
const database = new Database();
const loginCheck = (req, res, next) => {
    if (!req.cookies.token) {
        res.sendStatus(401);
        return;
    }
    req.username = loginManager.check(req.cookies.token);
    if (!req.username) {
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

app.post('/api/logout', loginCheck, async (req, res) => {
    loginManager.delete(req.cookies.token);
    res.clearCookie('token');
    res.redirect('/login');
});

app.get('/api/check', loginCheck);

app.post('/api/upload', loginCheck, upload.any(), (req, res) => {
    console.log(`[${req.username}] /upload request`);
    res.sendStatus(201);
});

app.post('/api/extract', loginCheck, express.json(), async (req, res) => {
    if (req.body == null || typeof req.body.file != 'string' || !req.username || !fs.existsSync(path.resolve(__dirname, '..', uploadDir, req.username, req.body.file)) || !(await fileTypeFromFile(path.resolve(__dirname, '..', uploadDir, req.username, req.body.file)))?.mime.startsWith('video') || !['image/jpeg', 'image/png', 'image/webp'].includes(req.body.mimetype) || typeof req.body.fps != 'number' || req.body.fps <= 0) {
        res.sendStatus(400);
        return;
    }
    console.log(`[${req.username}] /extract request`);
    try {
        const start = Date.now();
        const targetExt = mime.getExtension(req.body.mimetype)!;
        const targetCodec = targetExt == 'webp' ? 'libwebp' : targetExt == 'png' ? 'png' : targetExt == 'jpeg' ? 'mjpeg' : 'png';
        const zip = archiver('zip');
        let index = 0;
        ffmpeg(path.resolve(__dirname, '..', uploadDir, req.username, req.body.file)).fpsOutput(req.body.fps).videoCodec(targetCodec).format('image2pipe').outputOptions(['-update', '1']).pipe().on('data', data => {
            //note: 8192 byte buffer bug occurs on Mac - please check on linux etc.
            index++;
            zip.append(data, { name: 'img' + index + '.' + targetExt });
        }).on('end', async () => {
            console.log('done');
            res.setHeader('Content-Type', 'application/zip');
            console.log(`[${req.username}] sending shuffled zip`);
            zip.pipe(res).on('progress', (progress) => {
                console.log(`[${req.username}] Processed ${progress.totalBytes} bytes`)
            }).on('finish', () => {
                fs.unlink(path.resolve(__dirname, '..', uploadDir, req.username!, req.body.file), () => {});
                console.log(`[${req.username}] /extract request took ${Date.now()-start} ms`);
            });
            await zip.finalize();
        })
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
});

app.post('/api/shuffle', loginCheck, express.json(), async (req, res) => {
    if (req.body == null || !req.username || !Array.isArray(req.body.files) || !['image/jpeg', 'image/png', 'image/webp'].includes(req.body.mimetype) || !Number.isSafeInteger(req.body.batchSize) || req.body.batchSize < 1) {
        res.sendStatus(400);
        return;
    }
    for (const file of req.body.files) {
        if (typeof file != 'string' ||
            !fs.existsSync(path.resolve(__dirname, '..', uploadDir, req.username, file)) ||
            !(await fileTypeFromFile(path.resolve(__dirname, '..', uploadDir, req.username, file)))?.mime.startsWith('image')) {
        res.sendStatus(400);
        return;
        }
    }
    console.log(`[${req.username}] /shuffle request`);
    try {
        const start = Date.now();
        const targetExt = mime.getExtension(req.body.mimetype)!;
        const targetCodec = targetExt == 'webp' ? 'libwebp' : targetExt == 'png' ? 'png' : targetExt == 'jpeg' ? 'mjpeg' : 'png';
        const files: TaskFile[] = shuffleArray(req.body.files).map((file, index) => ({ task: Math.floor(Number(index) / req.body.batchSize), filename: file, targetFilename: file.split('/').slice(-1)[0] }));
        const zip = archiver('zip');
        await PromisePool.for(files).withConcurrency(10).process(async (file, fileIndex) => {
            if (mime.getType(file.filename) != req.body.mimetype) {
                await new Promise((resolve, reject) => {
                    let buf: Buffer[] = [];
                    ffmpeg(path.resolve(__dirname, '..', uploadDir, req.username!, file.filename)).videoCodec(targetCodec).format('image2').pipe().on('data', data => {
                        buf.push(data);
                    }).on('end', () => {
                        zip.append(Buffer.concat(buf), { name: path.join('task' + (file.task + 1), file.targetFilename) });
                        console.log(`[${req.username}] zipped file ${fileIndex % req.body.batchSize} of task ${Number(file.task)+1}`);
                        resolve(true);
                    });
                });
            } else {
                zip.append(fs.createReadStream(path.resolve(__dirname, '..', uploadDir, req.username!, file.filename)), { name: path.join('task' + (file.task + 1), file.targetFilename) });
                console.log(`[${req.username}] zipped file ${fileIndex % req.body.batchSize} of task ${Number(file.task)+1}`);
            }
        });
        res.setHeader('Content-Type', 'application/zip');
        console.log(`[${req.username}] sending shuffled zip`);
        zip.pipe(res).on('progress', (progress) => {
            console.log(`[${req.username}] Processed ${progress.totalBytes} bytes`)
        }).on('finish', () => {
            for (const file of files) fs.unlink(path.resolve(__dirname, '..', uploadDir, req.username!, file.filename), () => {});
            console.log(`[${req.username}] /shuffle request took ${Date.now()-start} ms`);
        });
        await zip.finalize();
    } catch (e) {
        console.error(e);
        res.sendStatus(500);
    }
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

declare global {
    namespace Express {
        interface Request {
            username?: string
        }
    }
}

/**Make it easier to work with shuffle*/
interface TaskFile {
    /**Which task this file is part of */
    task: number
    /**filename */
    filename: string
    /**target filename */
    targetFilename: string
}