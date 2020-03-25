FROM figureaps_backend-service

WORKDIR /opt/kontist/services/mockSolaris

EXPOSE 2091

# Run as Non-root
USER node

CMD ["yarn", "start"]
