import bodyParser from 'body-parser';
import cors from 'cors';
import {exec} from 'child_process';
import express from 'express';
import {createServer, Server as HttpServer} from 'http';
import {io, Socket} from 'socket.io-client';
import {defaultDeviceId, defaultDeviceName, defaultRoomName, defaultRoomToken, defaultServerUrl} from './constants';
import {loggerMiddleware} from './middlewares/logger';
import {emitEvent, fromEventTyped} from './events';
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

const socket: Socket = io(serverUrl);

fromEventTyped(socket, 'connect').subscribe(() => {
    emitEvent(socket, 'satelles join', {
        token: roomToken,
        roomName: roomName,
        satelles: {
            id: deviceId,
            name: deviceName,
            commands: [
                {
                    name: 'macOS controls',
                    type: 'complex',
                    args: [
                        {
                            name: 'Volume',
                            type: 'number',
                            numberMin: 0,
                            numberMax: 100,
                            numberStep: 1,
                        },
                    ],
                }
            ],
        },
    });
});

fromEventTyped(socket, 'imperium action').subscribe(action => {
    if (action.commandName == 'macOS controls') {
        (action.args || []).forEach(arg => {
            if (arg.name == 'Volume') {
                const volume = arg?.numberValue ?? 10;
                exec(`osascript -e 'set volume output volume ${volume} --100%'`)
            }
        })
    }
});

http.listen(port, () => console.log(`Listening on port ${port}!`));
