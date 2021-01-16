import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import {createServer, Server as HttpServer} from 'http';
import {BehaviorSubject, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {io, Socket} from 'socket.io-client';
import {defaultDeviceId, defaultDeviceName, defaultRoomName, defaultRoomToken, defaultServerUrl} from './constants';
import {loggerMiddleware} from './middlewares/logger';
import {emitEvent, fromEventTyped} from './events';
import {getVolume, setVolume, volumeCommand} from './utils';
import {configuration, version} from './version';

// Get config from env
const deviceId = process.env.DEVICE_ID || defaultDeviceId;
const deviceName = process.env.DEVICE_NAME || defaultDeviceName;
const serverUrl = process.env.SERVER_URL || defaultServerUrl;
const roomToken = process.env.ROOM_TOKEN || defaultRoomToken;
const roomName = process.env.ROOM_NAME || defaultRoomName;
const port = process.env.PORT || 4061;

// Creating web server
const app = express();
const http: HttpServer = createServer(app);

// HTTP middleware and CORS
app.use(loggerMiddleware);

const corsAllowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '';
app.use(
    (req, res, next) => next(),
    corsAllowedOrigin
        ? cors({origin: corsAllowedOrigin.split(','), optionsSuccessStatus: 200})
        : cors(),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// HTTP healthCheck route
app.get('/healthCheck', (request, response) => {
    response.send({hostname: request.hostname, status: 'ok', version, configuration});
});

console.log(`Connecting to ${serverUrl}...`)
const socket: Socket = io(serverUrl);

const connected$ = new Subject<void>();

const curVolume$ = new BehaviorSubject<number>(0);
const updateVolume = () => void getVolume()
    .then(res => {
        if (res !== null && res !== curVolume$.value) {
            curVolume$.next(res);
        }
    })
    .catch(err => console.error(err));

updateVolume();
setInterval(updateVolume, 10000);

fromEventTyped(socket, 'connect').subscribe(() => {
    console.log(`Connected to socket at ${serverUrl}`)

    connected$.next();

    emitEvent(socket, 'satelles join', {
        token: roomToken,
        roomName: roomName,
        satelles: {
            id: deviceId,
            name: deviceName,
            commands: [
                volumeCommand(curVolume$.value),
            ],
        },
    });

    curVolume$
        .pipe(takeUntil(connected$))
        .subscribe(cv => emitEvent(socket, 'satelles update', [volumeCommand(cv)]));
});

fromEventTyped(socket, 'imperium action').subscribe(action => {
    if (action.commandName == '_macos_controls') {
        (action.args || []).forEach(arg => {
            if (arg.name == 'Volume') {
                setVolume(arg?.numberValue ?? 10);
            }
        })
    }
});

http.listen(port, () => console.log(`Listening on port ${port}!`));
