FROM node:16.13.1-bullseye-slim AS builder

RUN mkdir /satelles-node
WORKDIR /satelles-node

COPY package.json package-lock.json tsconfig.json jest.config.js ./

RUN npm ci

COPY . .

RUN npm run build

#
# Go back from clean node image
#
FROM node:16.13.1-bullseye-slim

RUN mkdir /satelles-node /satelles-node/node_modules /satelles-node/dist
WORKDIR /satelles-node

COPY --from=builder ["/satelles-node/package.json", "/satelles-node/package-lock.json", "./"]
COPY --from=builder /satelles-node/node_modules ./node_modules/
COPY --from=builder /satelles-node/dist ./dist/

ARG VERSION=untagged
RUN echo $VERSION > /version.txt

CMD ["npm", "run", "serve"]
