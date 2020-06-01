FROM node:12

WORKDIR /opt/mockSolaris

EXPOSE 2091

# Run as Non-root
USER node

COPY --chown=node:node package.json .

RUN yarn

COPY --chown=node:node src ./src

RUN yarn build

CMD ["yarn", "start"]
