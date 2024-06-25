# Node satelles

Satelles for the Rerum Imperium project. In NodeJS

## Setup

Create the config file from template (then edit it to suit your env)
`cp config.template.yml config.yml`

## Run the server

`npm run start`

## Run tests

`npm run test`

## Run lint

`npm run lint`

With auto fix
`npm run lint:fix`

## Install as a system service on debian

Create file `/lib/systemd/system/satelles-node.service` with content (adapt paths if needed)

```
[Unit]
Description=Satelles node - run your things
Documentation=https://github.com/AymericBebert/satelles-node
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/pi/satelles-node
ExecStart=/usr/local/bin/node /home/pi/satelles-node/dist/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
