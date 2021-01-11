import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import {createServer, Server as HttpServer} from 'http';
import {emitEvent, fromEventTyped} from './events';
import {loggerMiddleware} from './middlewares/logger';
import {configuration, version} from './version';
import {defaultDeviceId, defaultDeviceName, defaultRoomName, defaultRoomToken, defaultServerUrl} from './constants';
import {io, Socket} from 'socket.io-client';

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
                    name: 'Example action',
                    type: 'info'
                }
            ],
        },
    });
});

http.listen(port, () => console.log(`Listening on port ${port}!`));
