FROM node:20-alpine

WORKDIR /app

# Copy workspace root files
COPY package.json turbo.json tsconfig.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

RUN npm install
RUN npm run db:generate
RUN npm run build --workspace=apps/web

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
