Create/modify the file `server/config/.env` and specify the following variables:
* `PORT` which changes the port the server is run on (and which port the client tries to connect to). It defaults to `6395`.

Note that downloading zipped files (especially if converting to png) will take a long time, please be patient.

## Building client

The client uses [Vue](https://vuejs.org/) and [Vite](https://vitejs.dev). [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) and [JSZip](https://stuk.github.io/jszip/) are also used for client-side processing. To build client, ensure you are in the `client` folder. Run
```bash
npm i
```
to install all required packages. Then, run
```bash
npx vite build
```
to build.

## Running server

The server is written with [Express.js](https://expressjs.com/) to handle HTTP requests, [FFmpeg](https://www.ffmpeg.org/) to process images, and [JSZip](https://stuk.github.io/jszip/) to zip files.

To specify logins, create/modify the file `server/database/logins.txt`, and enter username/bcrypt hashed password pairs in the format `<username>\n<password_hash>\n`. The example file has username and password both set to `tiwaki`. You can use https://bcrypt-generator.com/ to generate the hashed password from plaintext (recommended rounds: 10).

To start the server, ensure you are in the `server` folder. Run
```bash
npm i
```
to install all required packages. **You may also need to install ffmpeg if you don't have it already.** Then, run the commands
```bash
npm run compile
```
which compiles TS into JS, and
```bash
npm run start
```
which starts the server with the compiled JS.

Alternatively, use
```bash
npm run compilerun
```
to compile and start the server at the same time.

Now, you can access the website at `localhost:$PORT`.
