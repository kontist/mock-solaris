FROM node:12

WORKDIR /opt/mockSolaris

EXPOSE 2091

# Run as Non-root
USER node

COPY --chown=node:node package.json .

RUN npm ci

COPY --chown=node:node src ./src

RUN npm run build

CMD ["npm", "run", "start"]
