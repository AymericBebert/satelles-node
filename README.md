# Node satelles

Satelles for the Rerum Imperium project. In Node.js

## Setup

Create the config file from template (then edit it to suit your env)

```shell
cp config.template.yml config.yml
```

## Run the server

```shell
npm run start
```

## Run tests

```shell
npm run test
```

## Run lint

```shell
npm run lint
```

With auto fix

```shell
npm run lint:fix
```

## Install as a service

In `/lib/systemd/system/satelles-node.service`, write

```
[Unit]
Description=Satelles node - run your things
Documentation=https://github.com/AymericBebert/satelles-node
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/pi/satelles-node
ExecStart=/home/pi/.nvm/versions/node/v20.18.0/bin/node /home/pi/satelles-node/dist/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then enable the service

```bash
sudo systemctl enable satelles-node
sudo systemctl start satelles-node
```
