FROM node:latest
WORKDIR /app
COPY . .
RUN npm install
ENV SIGNING_SECRET=dev-signing-secret-0123456789abcdef
EXPOSE 3000
CMD ["node", "src/server.js"]
