# Docker file to run Apollo server
FROM node:14.21.0-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY ./package.json ./package-lock.json /app/
COPY ./ /app/

RUN npm install

EXPOSE 4000
CMD [ "npm", "start" ]