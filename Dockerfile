FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages paddlepaddle paddleocr

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3002
CMD ["npm", "start"]