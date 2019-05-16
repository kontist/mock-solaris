FROM figureaps_backend-service

WORKDIR /opt/kontist/services/mockSolaris

EXPOSE 2091

CMD ["yarn", "start"]
