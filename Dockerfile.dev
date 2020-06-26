FROM node:12

WORKDIR /opt/mockSolaris

EXPOSE 2091

COPY --chown=node:node package.json npm-shrinkwrap.json ./

RUN npm ci

COPY --chown=node:node dist ./dist

# Run as Non-root
USER node

CMD ["npm", "run", "start"]
