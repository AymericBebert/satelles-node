FROM node:14.15.3-stretch-slim AS builder

RUN mkdir /satelles-node
WORKDIR /satelles-node

COPY package.json package-lock.json tsconfig.json jest.config.js ./

RUN npm ci

COPY . .

ARG VERSION=untagged
ARG BUILD_CONFIGURATION=production
RUN echo "export const version = '$VERSION';\nexport const configuration = '$BUILD_CONFIGURATION';\n" > ./src/version.ts

RUN npm run build

#
# Go back from clean node image
#
FROM node:14.15.3-stretch-slim

RUN mkdir /satelles-node /satelles-node/node_modules /satelles-node/dist
WORKDIR /satelles-node

COPY --from=builder ["/satelles-node/package.json", "/satelles-node/package-lock.json", "./"]
COPY --from=builder /satelles-node/node_modules ./node_modules/
COPY --from=builder /satelles-node/dist ./dist/

EXPOSE 4060

CMD ["npm", "run", "serve"]
