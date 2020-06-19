FROM node:12

WORKDIR /opt/mockSolaris

EXPOSE 2091

COPY --chown=node:node package.json npm-shrinkwrap.json tsconfig.json ./

RUN npm ci

COPY --chown=node:node src ./src

RUN npm run build && rm -Rf src

# Run as Non-root
USER node

CMD ["npm", "run", "start"]
